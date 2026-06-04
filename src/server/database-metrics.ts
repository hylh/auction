import { databaseApplicationName, sqlClient } from "../db/client";
import { renderPrometheusText, type MetricFamily } from "../domain/metric-exposition";

export type DatabaseMetrics = {
  databaseSizeBytes: number;
  connections: {
    applicationName: string;
    total: number;
    active: number;
    idle: number;
    appTotal: number;
    appActive: number;
    appIdle: number;
  };
  tables: Array<{
    tableName: string;
    rowCount: number;
    totalBytes: number;
    heapBytes: number;
    indexBytes: number;
  }>;
  auctionStatuses: Array<{
    status: string;
    count: number;
  }>;
  inventoryStatuses: Array<{
    status: string;
    count: number;
  }>;
  load: {
    activeAuctions: number;
    bidsLastMinute: number;
    bidsLastFiveMinutes: number;
    auctionsCreatedLastMinute: number;
    averageBidsPerActiveAuction: number;
    hottestAuctionBidCount: number;
    newestBidAgeSeconds: number | null;
  };
};

const trackedTables = [
  "users",
  "fish_items",
  "auctions",
  "bids",
  "sales",
  "inventory_status_changes",
  "admin_actions",
];

export async function loadDatabaseMetrics(): Promise<DatabaseMetrics> {
  return sqlClient.begin(async (sql) => {
    const databaseSize = await sql<{ database_size_bytes: string }[]>`
      select pg_database_size(current_database())::text as database_size_bytes
    `;
    const rowCounts = await sql<{ table_name: string; row_count: string }[]>`
      select 'users' as table_name, count(*)::text as row_count from users
      union all select 'fish_items', count(*)::text from fish_items
      union all select 'auctions', count(*)::text from auctions
      union all select 'bids', count(*)::text from bids
      union all select 'sales', count(*)::text from sales
      union all select 'inventory_status_changes', count(*)::text from inventory_status_changes
      union all select 'admin_actions', count(*)::text from admin_actions
    `;
    const tableSizes = await sql<
      {
        table_name: string;
        total_bytes: string;
        heap_bytes: string;
        index_bytes: string;
      }[]
    >`
      select
        relname as table_name,
        pg_total_relation_size(relid)::text as total_bytes,
        pg_relation_size(relid)::text as heap_bytes,
        pg_indexes_size(relid)::text as index_bytes
      from pg_stat_user_tables
      where schemaname = 'public'
        and relname = any(${trackedTables})
    `;
    const auctionStatuses = await sql<{ status: string; count: string }[]>`
      select status::text, count(*)::text as count
      from auctions
      group by status
      order by status
    `;
    const inventoryStatuses = await sql<{ status: string; count: string }[]>`
      select status::text, count(*)::text as count
      from fish_items
      group by status
      order by status
    `;
    const connectionRows = await sql<
      {
        total_connections: string;
        active_connections: string;
        idle_connections: string;
        app_connections: string;
        app_active_connections: string;
        app_idle_connections: string;
      }[]
    >`
      select
        count(*)::text as total_connections,
        count(*) filter (where state = 'active')::text as active_connections,
        count(*) filter (where state = 'idle')::text as idle_connections,
        count(*) filter (where application_name = ${databaseApplicationName})::text as app_connections,
        count(*) filter (
          where application_name = ${databaseApplicationName} and state = 'active'
        )::text as app_active_connections,
        count(*) filter (
          where application_name = ${databaseApplicationName} and state = 'idle'
        )::text as app_idle_connections
      from pg_stat_activity
      where datname = current_database()
    `;
    const loadRows = await sql<
      {
        active_auctions: string;
        bids_last_minute: string;
        bids_last_five_minutes: string;
        auctions_created_last_minute: string;
        average_bids_per_active_auction: string | null;
        hottest_auction_bid_count: string | null;
        newest_bid_age_seconds: string | null;
      }[]
    >`
      with active_auctions as (
        select id from auctions where status = 'active'
      ),
      bids_by_active_auction as (
        select b.auction_id, count(*) as bid_count
        from bids b
        join active_auctions a on a.id = b.auction_id
        group by b.auction_id
      )
      select
        (select count(*) from active_auctions)::text as active_auctions,
        (select count(*) from bids where accepted_at > now() - interval '1 minute')::text as bids_last_minute,
        (select count(*) from bids where accepted_at > now() - interval '5 minutes')::text as bids_last_five_minutes,
        (select count(*) from auctions where created_at > now() - interval '1 minute')::text as auctions_created_last_minute,
        (select avg(bid_count)::text from bids_by_active_auction) as average_bids_per_active_auction,
        (select max(bid_count)::text from bids_by_active_auction) as hottest_auction_bid_count,
        (select extract(epoch from now() - max(accepted_at))::text from bids) as newest_bid_age_seconds
    `;

    const rowCountByTable = new Map(
      rowCounts.map((row) => [row.table_name, parseNumber(row.row_count)]),
    );
    const sizeByTable = new Map(tableSizes.map((row) => [row.table_name, row]));
    const connections = connectionRows[0];
    const load = loadRows[0];

    return {
      databaseSizeBytes: parseNumber(databaseSize[0]?.database_size_bytes),
      connections: {
        applicationName: databaseApplicationName,
        total: parseNumber(connections?.total_connections),
        active: parseNumber(connections?.active_connections),
        idle: parseNumber(connections?.idle_connections),
        appTotal: parseNumber(connections?.app_connections),
        appActive: parseNumber(connections?.app_active_connections),
        appIdle: parseNumber(connections?.app_idle_connections),
      },
      tables: trackedTables.map((tableName) => {
        const size = sizeByTable.get(tableName);
        return {
          tableName,
          rowCount: rowCountByTable.get(tableName) ?? 0,
          totalBytes: parseNumber(size?.total_bytes),
          heapBytes: parseNumber(size?.heap_bytes),
          indexBytes: parseNumber(size?.index_bytes),
        };
      }),
      auctionStatuses: auctionStatuses.map((row) => ({
        status: row.status,
        count: parseNumber(row.count),
      })),
      inventoryStatuses: inventoryStatuses.map((row) => ({
        status: row.status,
        count: parseNumber(row.count),
      })),
      load: {
        activeAuctions: parseNumber(load?.active_auctions),
        bidsLastMinute: parseNumber(load?.bids_last_minute),
        bidsLastFiveMinutes: parseNumber(load?.bids_last_five_minutes),
        auctionsCreatedLastMinute: parseNumber(load?.auctions_created_last_minute),
        averageBidsPerActiveAuction: parseNumber(load?.average_bids_per_active_auction),
        hottestAuctionBidCount: parseNumber(load?.hottest_auction_bid_count),
        newestBidAgeSeconds:
          load?.newest_bid_age_seconds === null || load?.newest_bid_age_seconds === undefined
            ? null
            : Math.round(parseNumber(load.newest_bid_age_seconds)),
      },
    };
  });
}

export function databaseMetricsText(metrics: DatabaseMetrics) {
  return renderPrometheusText(databaseMetricsFamilies(metrics));
}

function databaseMetricsFamilies(metrics: DatabaseMetrics): Array<MetricFamily> {
  return [
    gaugeFamily("auction_database_size_bytes", "PostgreSQL database size in bytes", [
      { value: metrics.databaseSizeBytes },
    ]),
    gaugeFamily("auction_database_connections", "PostgreSQL connection count by state", [
      { labels: [["state", "total"]], value: metrics.connections.total },
      { labels: [["state", "active"]], value: metrics.connections.active },
      { labels: [["state", "idle"]], value: metrics.connections.idle },
    ]),
    gaugeFamily(
      "auction_database_app_connections",
      "PostgreSQL connection count for this application",
      [
        {
          labels: [
            ["application", metrics.connections.applicationName],
            ["state", "total"],
          ],
          value: metrics.connections.appTotal,
        },
        {
          labels: [
            ["application", metrics.connections.applicationName],
            ["state", "active"],
          ],
          value: metrics.connections.appActive,
        },
        {
          labels: [
            ["application", metrics.connections.applicationName],
            ["state", "idle"],
          ],
          value: metrics.connections.appIdle,
        },
      ],
    ),
    gaugeFamily(
      "auction_database_table_rows",
      "Exact table row count",
      metrics.tables.map((table) => ({
        labels: [["table", table.tableName]],
        value: table.rowCount,
      })),
    ),
    gaugeFamily(
      "auction_database_table_size_bytes",
      "PostgreSQL table size in bytes",
      metrics.tables.flatMap((table) => [
        {
          labels: [
            ["table", table.tableName],
            ["kind", "total"],
          ],
          value: table.totalBytes,
        },
        {
          labels: [
            ["table", table.tableName],
            ["kind", "heap"],
          ],
          value: table.heapBytes,
        },
        {
          labels: [
            ["table", table.tableName],
            ["kind", "index"],
          ],
          value: table.indexBytes,
        },
      ]),
    ),
    gaugeFamily("auction_database_active_auctions", "Active auction count from PostgreSQL", [
      { value: metrics.load.activeAuctions },
    ]),
    gaugeFamily("auction_database_bids_recent", "Recent accepted bids from PostgreSQL", [
      { labels: [["window", "1m"]], value: metrics.load.bidsLastMinute },
      { labels: [["window", "5m"]], value: metrics.load.bidsLastFiveMinutes },
    ]),
    gaugeFamily(
      "auction_database_auctions_created_recent",
      "Recently created auctions from PostgreSQL",
      [{ labels: [["window", "1m"]], value: metrics.load.auctionsCreatedLastMinute }],
    ),
    gaugeFamily(
      "auction_database_active_auction_bid_distribution",
      "Bid concentration across active auctions",
      [
        { labels: [["stat", "average"]], value: metrics.load.averageBidsPerActiveAuction },
        { labels: [["stat", "max"]], value: metrics.load.hottestAuctionBidCount },
      ],
    ),
  ];
}

function parseNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }
  return typeof value === "number" ? value : Number(value);
}

function gaugeFamily(
  name: string,
  help: string,
  samples: Array<{ labels?: Array<[string, string]>; value: number }>,
): MetricFamily {
  return {
    name,
    help,
    type: "gauge",
    samples,
  };
}
