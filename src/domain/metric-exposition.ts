export type MetricType = "counter" | "gauge" | "histogram";

export type MetricLabel = readonly [name: string, value: string | number];

export type MetricSample = {
  name?: string;
  labels?: ReadonlyArray<MetricLabel>;
  value: number;
};

export type HistogramMetricFamily = {
  name: string;
  help: string;
  type: "histogram";
  buckets: ReadonlyArray<{
    le: number | "+Inf";
    count: number;
  }>;
  sum: number;
  count: number;
};

export type SampleMetricFamily = {
  name: string;
  help: string;
  type: Exclude<MetricType, "histogram">;
  samples: ReadonlyArray<MetricSample>;
};

export type MetricFamily = HistogramMetricFamily | SampleMetricFamily;

export function renderPrometheusText(families: ReadonlyArray<MetricFamily>) {
  return [...families.flatMap(renderMetricFamily), ""].join("\n");
}

function formatMetricNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(6);
}

function renderMetricFamily(family: MetricFamily) {
  if (family.type === "histogram") {
    return [
      `# HELP ${family.name} ${family.help}`,
      `# TYPE ${family.name} histogram`,
      ...family.buckets.map((bucket) => `${family.name}_bucket{le="${bucket.le}"} ${bucket.count}`),
      `${family.name}_sum ${formatMetricNumber(family.sum)}`,
      `${family.name}_count ${family.count}`,
    ];
  }

  return [
    `# HELP ${family.name} ${family.help}`,
    `# TYPE ${family.name} ${family.type}`,
    ...family.samples.map(
      (sample) =>
        `${sample.name ?? family.name}${formatLabels(sample.labels ?? [])} ${formatMetricNumber(sample.value)}`,
    ),
  ];
}

function formatLabels(labels: ReadonlyArray<MetricLabel>) {
  if (labels.length === 0) {
    return "";
  }

  return `{${labels.map(([name, value]) => `${name}="${escapeLabelValue(String(value))}"`).join(",")}}`;
}

function escapeLabelValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}
