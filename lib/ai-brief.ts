import crypto from 'crypto';
import { HourlyDropoffBucket, WaitlistAiBrief, WaitlistEntry } from '@/types/waitlist';
import { getAllTodayEntries, getCachedAiBrief, getTodayDateStr, saveAiBrief } from '@/lib/waitlist-store';

export interface AnonymizedServiceAggregate {
  serviceDate: string;
  totalParties: number;
  seatedCount: number;
  leftCount: number;
  noShowCount: number;
  avgQuotedMinutes: number;
  avgActualWaitMinutes: number;
  hourlyBreakdown: HourlyDropoffBucket[];
  partySizeDropoffs: Array<{
    bucket: '1-2' | '3-4' | '5-6' | '7+';
    total: number;
    lost: number;
  }>;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 am';
  if (hour < 12) return `${hour} am`;
  if (hour === 12) return '12 pm';
  return `${hour - 12} pm`;
}

/**
 * Strictly strips all guest PII (names, phones, IDs, ticket numbers)
 * and builds an anonymized statistical aggregate for analytics & AI brief generation.
 */
export function buildAnonymizedAggregate(
  entries: WaitlistEntry[],
  serviceDate: string
): AnonymizedServiceAggregate {
  let seatedCount = 0;
  let leftCount = 0;
  let noShowCount = 0;
  let quotedSum = 0;
  let actualWaitSum = 0;
  let actualWaitCount = 0;

  const hourMap = new Map<number, { left: number; noShow: number; seated: number }>();
  const sizeBuckets: Record<'1-2' | '3-4' | '5-6' | '7+', { total: number; lost: number }> = {
    '1-2': { total: 0, lost: 0 },
    '3-4': { total: 0, lost: 0 },
    '5-6': { total: 0, lost: 0 },
    '7+': { total: 0, lost: 0 },
  };

  for (const e of entries) {
    quotedSum += e.quotedWaitMinutes || 0;

    const bucketKey: '1-2' | '3-4' | '5-6' | '7+' =
      e.partySize <= 2 ? '1-2' : e.partySize <= 4 ? '3-4' : e.partySize <= 6 ? '5-6' : '7+';
    sizeBuckets[bucketKey].total++;

    const eventTime = new Date(e.resolvedAt || e.calledAt || e.joinedAt);
    const hour = Number.isFinite(eventTime.getTime()) ? eventTime.getHours() : 12;
    if (!hourMap.has(hour)) {
      hourMap.set(hour, { left: 0, noShow: 0, seated: 0 });
    }
    const hRec = hourMap.get(hour)!;

    if (e.status === 'seated') {
      seatedCount++;
      hRec.seated++;
      if (e.resolvedAt) {
        const waitMins = (new Date(e.resolvedAt).getTime() - new Date(e.joinedAt).getTime()) / 60000;
        if (waitMins >= 1 && waitMins <= 180) {
          actualWaitSum += waitMins;
          actualWaitCount++;
        }
      }
    } else if (e.status === 'left') {
      leftCount++;
      hRec.left++;
      sizeBuckets[bucketKey].lost++;
    } else if (e.status === 'no_show') {
      noShowCount++;
      hRec.noShow++;
      sizeBuckets[bucketKey].lost++;
    }
  }

  // Ensure a clean contiguous range of active hours for charting
  const hours = Array.from(hourMap.keys()).sort((a, b) => a - b);
  const minHour = hours.length > 0 ? Math.min(...hours) : 9;
  const maxHour = hours.length > 0 ? Math.max(...hours) : 14;

  const hourlyBreakdown: HourlyDropoffBucket[] = [];
  for (let h = minHour; h <= maxHour; h++) {
    const rec = hourMap.get(h) || { left: 0, noShow: 0, seated: 0 };
    hourlyBreakdown.push({
      hour: h,
      hourLabel: formatHourLabel(h),
      left: rec.left,
      noShow: rec.noShow,
      seated: rec.seated,
      totalDropoff: rec.left + rec.noShow,
    });
  }

  return {
    serviceDate,
    totalParties: entries.length,
    seatedCount,
    leftCount,
    noShowCount,
    avgQuotedMinutes: entries.length > 0 ? Math.round(quotedSum / entries.length) : 0,
    avgActualWaitMinutes: actualWaitCount > 0 ? Math.round(actualWaitSum / actualWaitCount) : 0,
    hourlyBreakdown,
    partySizeDropoffs: (['1-2', '3-4', '5-6', '7+'] as const).map((bucket) => ({
      bucket,
      total: sizeBuckets[bucket].total,
      lost: sizeBuckets[bucket].lost,
    })),
  };
}

export function computeAggregateFingerprint(agg: AnonymizedServiceAggregate): string {
  return crypto.createHash('sha256').update(JSON.stringify(agg)).digest('hex');
}

function buildDeterministicBrief(agg: AnonymizedServiceAggregate): {
  summaryWhereLost: string;
  recommendations: string[];
  modelUsed: string;
} {
  const totalLost = agg.leftCount + agg.noShowCount;
  if (agg.totalParties === 0 || totalLost === 0) {
    return {
      summaryWhereLost:
        agg.totalParties === 0
          ? 'No waitlist parties have been recorded yet today. As guests join and resolve, drop-off patterns will appear here.'
          : `All ${agg.seatedCount} resolved parties today were seated cleanly with zero walk-aways or no-shows.`,
      recommendations: [
        'Keep the door QR sign visible during peak transition hours so walk-ins self-register.',
        'Monitor quoted vs. actual wait times as larger parties (5+) arrive.',
        'Use the 5-minute claim countdown on the Host Stand to keep table turnover crisp.',
      ],
      modelUsed: 'deterministic-stats',
    };
  }

  const peakLossHour = [...agg.hourlyBreakdown].sort((a, b) => b.totalDropoff - a.totalDropoff)[0];
  const worstBucket = [...agg.partySizeDropoffs].sort((a, b) => b.lost - a.lost)[0];

  const lossRate = Math.round((totalLost / Math.max(1, agg.totalParties)) * 100);
  const summaryWhereLost = `Today you lost ${totalLost} of ${agg.totalParties} parties (${lossRate}%): ${agg.leftCount} walked away while waiting and ${agg.noShowCount} did not claim their table after being called. Peak drop-off occurred around ${peakLossHour?.hourLabel || 'peak service'} (${peakLossHour?.totalDropoff || totalLost} lost), with ${worstBucket?.bucket || '3-4'}-guest parties accounting for ${worstBucket?.lost || 0} of those losses.`;

  const recs: string[] = [];
  if (agg.leftCount >= agg.noShowCount) {
    recs.push(
      `Tighten wait quotes for ${worstBucket?.bucket || 'larger'} parties: average quoted wait was ${agg.avgQuotedMinutes}m vs. ${agg.avgActualWaitMinutes || agg.avgQuotedMinutes}m actual turn time.`
    );
  } else {
    recs.push(
      `Follow up at the 3-minute mark on called parties: ${agg.noShowCount} no-shows missed the 5:00 claim window around ${peakLossHour?.hourLabel || 'peak hours'}.`
    );
  }
  recs.push(
    `Pre-stage flexible seating around ${peakLossHour?.hourLabel || 'peak hours'} and encourage "Either" seating at the host stand to turn tables faster.`
  );
  recs.push(
    `Remind guests with "I'm on my way" enabled that keeping the ticket tab open triggers an instant buzzer chime.`
  );

  return {
    summaryWhereLost,
    recommendations: recs,
    modelUsed: 'deterministic-stats',
  };
}

async function generateWithLlmIfConfigured(agg: AnonymizedServiceAggregate): Promise<{
  summaryWhereLost: string;
  recommendations: string[];
  modelUsed: string;
} | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  // Strictly anonymized payload — zero names, zero phones, zero IDs
  const prompt = `You are an operations advisor for a busy restaurant host stand.
Analyze ONLY these anonymized aggregate waitlist counts and write:
1) "summaryWhereLost": 2 concise sentences explaining where guests were lost (hours, walk-aways vs no-shows, party size).
2) "recommendations": array of exactly 3 short, concrete operational bullets for next weekend.
Return valid JSON: {"summaryWhereLost":"...","recommendations":["...","...","..."]}.
Data: ${JSON.stringify(agg)}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as {
      summaryWhereLost?: string;
      recommendations?: string[];
    };
    if (parsed.summaryWhereLost && Array.isArray(parsed.recommendations)) {
      return {
        summaryWhereLost: parsed.summaryWhereLost,
        recommendations: parsed.recommendations.slice(0, 3),
        modelUsed: 'gpt-4o-mini',
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function getOrGenerateOwnerBrief(
  slug: string,
  serviceDate = getTodayDateStr()
): Promise<WaitlistAiBrief> {
  const entries = await getAllTodayEntries(slug, serviceDate);
  const agg = buildAnonymizedAggregate(entries, serviceDate);
  const fingerprint = computeAggregateFingerprint(agg);

  const cached = await getCachedAiBrief(slug, serviceDate, fingerprint);
  if (cached) {
    return {
      id: cached.id,
      restaurantSlug: slug,
      serviceDate,
      dataFingerprint: fingerprint,
      summaryWhereLost: cached.summaryWhereLost,
      recommendations: cached.recommendations,
      modelUsed: cached.modelUsed,
      generatedAt: cached.generatedAt,
      cached: true,
      hourlyBreakdown: agg.hourlyBreakdown,
      stats: {
        totalParties: agg.totalParties,
        seatedCount: agg.seatedCount,
        leftCount: agg.leftCount,
        noShowCount: agg.noShowCount,
        avgQuotedMinutes: agg.avgQuotedMinutes,
        avgActualWaitMinutes: agg.avgActualWaitMinutes,
      },
    };
  }

  const llmResult = await generateWithLlmIfConfigured(agg);
  const generated = llmResult || buildDeterministicBrief(agg);

  const brief: WaitlistAiBrief = {
    id: crypto.randomUUID(),
    restaurantSlug: slug,
    serviceDate,
    dataFingerprint: fingerprint,
    summaryWhereLost: generated.summaryWhereLost,
    recommendations: generated.recommendations,
    modelUsed: generated.modelUsed,
    generatedAt: new Date().toISOString(),
    cached: false,
    hourlyBreakdown: agg.hourlyBreakdown,
    stats: {
      totalParties: agg.totalParties,
      seatedCount: agg.seatedCount,
      leftCount: agg.leftCount,
      noShowCount: agg.noShowCount,
      avgQuotedMinutes: agg.avgQuotedMinutes,
      avgActualWaitMinutes: agg.avgActualWaitMinutes,
    },
  };

  await saveAiBrief(brief);
  return brief;
}
