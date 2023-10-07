import { api } from "@/src/utils/api";
import { type FilterState } from "@/src/features/filters/types";
import { TotalMetric } from "./TotalMetric";
import { numberFormatter, usdFormatter } from "@/src/utils/numbers";
import { DashboardTable } from "@/src/features/dashboard/components/DashboardTable";
import { RightAlighnedCell } from "@/src/features/dashboard/components/RightAlighnedCell";

export const MetricTable = ({
  className,
  projectId,
  globalFilterState,
}: {
  className: string;
  projectId: string;
  globalFilterState: FilterState;
}) => {
  const localFilters = globalFilterState.map((f) => ({
    ...f,
    column: "timestamp",
  }));

  const metrics = api.dashboard.chart.useQuery({
    projectId,
    from: "traces_observations",
    select: [
      { column: "totalTokenCost", agg: null },
      { column: "totalTokens", agg: "SUM" },
      { column: "model", agg: null },
    ],
    filter: localFilters ?? [],
    groupBy: [{ type: "string", column: "model" }],
    orderBy: [{ column: "totalTokenCost", direction: "DESC", agg: null }],
    limit: null,
  });

  const totalTokens = metrics.data?.reduce(
    (acc, curr) =>
      acc + (curr.totalTokenCost ? (curr.totalTokenCost as number) : 0),
    0,
  );

  return (
    <DashboardTable
      className={className}
      title="Model costs"
      isLoading={metrics.isLoading}
      headers={[
        "Model",
        <RightAlighnedCell key={1}>Total tokens</RightAlighnedCell>,
        <RightAlighnedCell key={1}>Total cost</RightAlighnedCell>,
      ]}
      rows={
        metrics.data
          ? metrics.data
              .filter((item) => item.model !== null)
              .map((item, i) => [
                item.model as string,
                <RightAlighnedCell key={i}>
                  {item.sumTotalTokens
                    ? numberFormatter(item.sumTotalTokens as number)
                    : "0"}
                </RightAlighnedCell>,
                <RightAlighnedCell key={i}>
                  {item.totalTokenCost
                    ? usdFormatter(item.totalTokenCost as number)
                    : "$0"}
                </RightAlighnedCell>,
              ])
          : []
      }
    >
      <TotalMetric
        metric={totalTokens ? usdFormatter(totalTokens) : "$0"}
        description="Total cost"
      />
    </DashboardTable>
  );
};
