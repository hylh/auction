import { formatMoneyWhole } from "../../domain/money";
import type { DashboardData } from "../../server/auction-types";

export function StatStrip({ stats }: { stats: DashboardData["stats"] }) {
  return (
    <section className="stat-strip">
      <div className="stat teal">
        <div className="label">Total sales today</div>
        <div className="value">{formatMoneyWhole(stats.totalSalesTodayCents)}</div>
        <div className="delta">▲ from completed auctions</div>
      </div>
      <div className="stat blue">
        <div className="label">Average bid</div>
        <div className="value">{formatMoneyWhole(stats.averageBidCents)}</div>
        <div className="delta">all accepted bids</div>
      </div>
      <div className="stat amber">
        <div className="label">Active auctions</div>
        <div className="value">{stats.activeAuctionCount}</div>
        <div className="delta">live on the floor</div>
      </div>
      <div className="stat violet">
        <div className="label">Bids / min</div>
        <div className="value">{stats.bidsLastMinute}</div>
        <div className="delta">▲ last 60 seconds</div>
      </div>
    </section>
  );
}
