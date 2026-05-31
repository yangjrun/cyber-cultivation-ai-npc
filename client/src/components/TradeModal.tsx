import { useState } from "react";
import { useGameStore } from "../state/store";
import type { ShopBuyEntry, ShopSellEntry } from "../api/tradeApi";

type TradeTab = "buy" | "sell";

export function TradeModal() {
  const open = useGameStore((state) => state.tradeModalOpen);
  const loading = useGameStore((state) => state.tradeLoading);
  const shop = useGameStore((state) => state.shop);
  const playerStones = useGameStore((state) => state.player.spiritStones);
  const close = useGameStore((state) => state.closeTradeModal);
  const buy = useGameStore((state) => state.buyTradeItem);
  const sell = useGameStore((state) => state.sellTradeItem);
  const lastTradeResult = useGameStore((state) => state.lastTradeResult);
  const tradeResultTick = useGameStore((state) => state.tradeResultTick);
  const [tab, setTab] = useState<TradeTab>("buy");

  if (!open) {
    return null;
  }

  const refused = shop?.refused ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="交易">
      <div className="cultivation-panel cultivation-panel--rose cultivation-corner w-full max-w-lg p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-rose-300/85">交易终端</p>
            <h2 className="mt-1 text-xl font-semibold text-rose-100">{shop?.npcName ? `与${shop.npcName}交易` : "交易"}</h2>
          </div>
          <button type="button" onClick={close} className="rounded border border-slate-500/40 px-2 py-1 text-xs text-slate-200 hover:border-rose-200">
            关闭
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between rounded-lg border border-rose-300/15 bg-slate-950/60 px-3 py-2 text-xs">
          <span className="text-slate-300">你的灵石：<span className="font-mono text-amber-200" data-testid="trade-player-stones">{playerStones}</span></span>
          <span className="text-slate-300">对方灵石：<span className="font-mono text-amber-200">{shop?.npcSpiritStones ?? 0}</span></span>
        </div>

        {refused ? (
          <div data-testid="trade-refused" className="mb-3 rounded-lg border border-rose-400/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {shop?.reason ?? "对方拒绝与你交易。"}
          </div>
        ) : null}

        <div className="mb-3 flex gap-2">
          <TabButton label="买入" active={tab === "buy"} onClick={() => setTab("buy")} />
          <TabButton label="卖出" active={tab === "sell"} onClick={() => setTab("sell")} />
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {loading && !shop ? <p className="text-xs text-slate-400">加载中...</p> : null}
          {tab === "buy"
            ? renderBuyList(shop?.items ?? [], { refused, loading, playerStones, buy })
            : renderSellList(shop?.sellQuotes ?? [], { refused, loading, npcStones: shop?.npcSpiritStones ?? 0, sell })}
        </div>

        {lastTradeResult ? (
          <div
            key={tradeResultTick}
            data-testid="trade-result"
            className="mt-3 animate-flash rounded-xl border border-rose-300/25 bg-slate-950/60 px-3 py-2 text-xs text-rose-100"
          >
            {lastTradeResult}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function renderBuyList(
  items: ShopBuyEntry[],
  ctx: { refused: boolean; loading: boolean; playerStones: number; buy: (itemId: string, quantity: number) => Promise<void> }
) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-400">对方暂无货物。</p>;
  }

  return items.map((entry) => {
    const disabled = ctx.refused || ctx.loading || entry.quantity <= 0 || ctx.playerStones < entry.buyUnitPrice;

    return (
      <TradeRow
        key={entry.itemId}
        name={entry.item?.name ?? entry.itemId}
        description={entry.item?.description ?? ""}
        meta={`库存 ${entry.quantity} · 单价 ${entry.buyUnitPrice} 灵石`}
        actionLabel="买入"
        disabled={disabled}
        onAction={() => void ctx.buy(entry.itemId, 1)}
        testId={`trade-buy-${entry.itemId}`}
      />
    );
  });
}

function renderSellList(
  quotes: ShopSellEntry[],
  ctx: { refused: boolean; loading: boolean; npcStones: number; sell: (itemId: string, quantity: number) => Promise<void> }
) {
  if (quotes.length === 0) {
    return <p className="text-xs text-slate-400">你没有可出售的物品。</p>;
  }

  return quotes.map((entry) => {
    const disabled = ctx.refused || ctx.loading || entry.quantity <= 0 || ctx.npcStones < entry.sellUnitPrice;

    return (
      <TradeRow
        key={entry.itemId}
        name={entry.item?.name ?? entry.itemId}
        description={entry.item?.description ?? ""}
        meta={`持有 ${entry.quantity} · 售价 ${entry.sellUnitPrice} 灵石`}
        actionLabel="卖出"
        disabled={disabled}
        onAction={() => void ctx.sell(entry.itemId, 1)}
        testId={`trade-sell-${entry.itemId}`}
      />
    );
  });
}

type TradeRowProps = {
  name: string;
  description: string;
  meta: string;
  actionLabel: string;
  disabled: boolean;
  onAction: () => void;
  testId: string;
};

function TradeRow({ name, description, meta, actionLabel, disabled, onAction, testId }: TradeRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-300/15 bg-slate-950/60 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm text-rose-100">{name}</p>
        <p className="truncate text-[11px] text-slate-400">{description}</p>
        <p className="mt-0.5 text-[11px] text-amber-200/80">{meta}</p>
      </div>
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={onAction}
        className="shrink-0 rounded-md bg-gradient-to-r from-rose-400 to-amber-300 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-950 transition disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
      >
        {actionLabel}
      </button>
    </div>
  );
}

type TabButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
        active ? "bg-rose-400/20 text-rose-100 border border-rose-300/40" : "border border-slate-500/30 text-slate-300 hover:border-rose-200"
      }`}
    >
      {label}
    </button>
  );
}
