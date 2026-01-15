import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { getSubgraphClient } from "../../lib/subgraph";
import {
  QUERY_MY_CREATED_RAFFLES,
  QUERY_MY_ACTIVITY_EVENTS,
} from "../../lib/queries";
import { friendlyStatus } from "../../lib/format";
import { timeAgoFromSeconds } from "../../lib/time";

export function DashboardPage({
  onOpenRaffle,
}: {
  onOpenRaffle: (raffleId: string) => void;
}) {
  const { address } = useAccount();

  const me = address?.toLowerCase();
  const client = getSubgraphClient();

  const createdQ = useQuery({
    queryKey: ["dashboard", "created", me],
    enabled: !!me,
    queryFn: () =>
      client.request(QUERY_MY_CREATED_RAFFLES, {
        me,
        first: 50,
      }),
  });

  const activityQ = useQuery({
    queryKey: ["dashboard", "activity", me],
    enabled: !!me,
    queryFn: () =>
      client.request(QUERY_MY_ACTIVITY_EVENTS, {
        me,
        first: 100,
      }),
  });

  const created = createdQ.data?.raffles ?? [];
  const events = activityQ.data?.raffleEvents ?? [];

  // Group activity by raffle
  const activityByRaffle = useMemo(() => {
    const map = new Map<string, any>();
    for (const e of events) {
      const id = e.raffle.id.toLowerCase();
      if (!map.has(id)) {
        map.set(id, { raffle: e.raffle, events: [] });
      }
      map.get(id).events.push(e);
    }
    return Array.from(map.values());
  }, [events]);

  return (
    <div className="max-w-5xl mx-auto px-4 pb-20">
      <h1 className="text-3xl font-black mb-6">Your Dashboard</h1>

      {/* CREATED */}
      <Section title="Raffles you created">
        {createdQ.isLoading && <Loading />}
        {!createdQ.isLoading && created.length === 0 && (
          <Empty>You haven’t created any raffles yet.</Empty>
        )}

        <List>
          {created.map((r: any) => (
            <Row key={r.id} onClick={() => onOpenRaffle(r.id)}>
              <Left>
                <Title>{r.name}</Title>
                <Meta>
                  Created {timeAgoFromSeconds(r.createdAtTimestamp)}
                </Meta>
              </Left>
              <Right>
                <Status>{friendlyStatus(r.status)}</Status>
                <Small>
                  {r.sold} sold · {r.winningPot} USDC
                </Small>
              </Right>
            </Row>
          ))}
        </List>
      </Section>

      {/* ACTIVITY */}
      <Section title="Your activity">
        {activityQ.isLoading && <Loading />}
        {!activityQ.isLoading && activityByRaffle.length === 0 && (
          <Empty>You haven’t joined any raffles yet.</Empty>
        )}

        <List>
          {activityByRaffle.map(({ raffle, events }: any) => (
            <Row
              key={raffle.id}
              onClick={() => onOpenRaffle(raffle.id)}
            >
              <Left>
                <Title>{raffle.name}</Title>
                <Meta>
                  {events.length} action{events.length > 1 ? "s" : ""}
                </Meta>
              </Left>
              <Right>
                <Status>{friendlyStatus(raffle.status)}</Status>
                <Small>{raffle.winningPot} USDC pot</Small>
              </Right>
            </Row>
          ))}
        </List>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small UI helpers (kept local on purpose)                            */
/* ------------------------------------------------------------------ */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-black mb-3">{title}</h2>
      {children}
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function Row({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 rounded-2xl bg-white/70 hover:bg-white cursor-pointer border border-gray-200 shadow-sm transition"
    >
      {children}
    </div>
  );
}

function Left({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function Right({ children }: { children: React.ReactNode }) {
  return <div className="text-right">{children}</div>;
}

function Title({ children }: { children: React.ReactNode }) {
  return <div className="font-bold">{children}</div>;
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-500">{children}</div>;
}

function Status({ children }: { children: React.ReactNode }) {
  return <div className="font-bold text-sm">{children}</div>;
}

function Small({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-gray-500">{children}</div>;
}

function Loading() {
  return <div className="p-4 text-gray-500">Loading…</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="p-4 text-gray-400">{children}</div>;
}