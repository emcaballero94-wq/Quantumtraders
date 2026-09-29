//+------------------------------------------------------------------+
//|                                        QuantumJournalBridge.mq5 |
//|                                                                  |
//| Watches every deal on the account and pushes each closed trade   |
//| to the Quantum Traders OS trade journal (POST /api/journal/trades)|
//| as it happens. Attach to any single chart — it captures trades   |
//| on every symbol for the account, not just the chart it sits on.  |
//+------------------------------------------------------------------+
#property copyright "Quantum Traders OS"
#property version   "1.00"
#property strict

input string InpApiUrl   = "https://emmanuelcaballero.com/api/journal/trades"; // Journal API endpoint
input string InpApiKey   = "";                                                  // Shared secret (MT5_JOURNAL_API_KEY on the server)
input int    InpTimeoutMs = 5000;                                               // WebRequest timeout (ms)

// One row per currently open position, so we can recover its entry price,
// side and SL/TP when the matching closing deal arrives later.
struct OpenPositionInfo
{
   long   positionId;
   string symbol;
   string side;         // "BUY" or "SELL"
   double entryPrice;
   double stopLoss;
   double takeProfit;
};

OpenPositionInfo g_openPositions[];

//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(InpApiKey) == 0)
      Print("QuantumJournalBridge: InpApiKey is empty — the server will reject every trade. ",
            "Set it to the same value as MT5_JOURNAL_API_KEY on the server.");

   Print("QuantumJournalBridge: running, posting closed trades to ", InpApiUrl);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   ArrayFree(g_openPositions);
}

//+------------------------------------------------------------------+
int FindOpenPositionIndex(const long positionId)
{
   for(int i = 0; i < ArraySize(g_openPositions); i++)
      if(g_openPositions[i].positionId == positionId)
         return i;
   return -1;
}

void StoreOpenPosition(const OpenPositionInfo &info)
{
   int idx = FindOpenPositionIndex(info.positionId);
   if(idx < 0)
   {
      idx = ArraySize(g_openPositions);
      ArrayResize(g_openPositions, idx + 1);
   }
   g_openPositions[idx] = info;
}

void RemoveOpenPositionAt(const int idx)
{
   if(idx < 0 || idx >= ArraySize(g_openPositions)) return;
   ArrayRemove(g_openPositions, idx, 1);
}

//+------------------------------------------------------------------+
string EscapeJson(const string text)
{
   string result = text;
   StringReplace(result, "\\", "\\\\");
   StringReplace(result, "\"", "\\\"");
   return result;
}

string NumberOrNull(const double value, const int digits)
{
   if(value == 0) return "null";
   return DoubleToString(value, digits);
}

// Best-effort broker-server-time -> UTC correction. TimeGMT() is the
// terminal's internet-synced UTC estimate; TimeTradeServer() is the
// broker's current server time. Deals are timestamped in server time,
// so the same offset is applied to them. Not exact for every broker,
// but close enough for a journal entry.
string TimeToIso8601Utc(const datetime serverTime)
{
   int offset = (int)(TimeGMT() - TimeTradeServer());
   datetime utcApprox = serverTime + offset;
   MqlDateTime dt;
   TimeToStruct(utcApprox, dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                        dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

//+------------------------------------------------------------------+
void SendTradeToJournal(const OpenPositionInfo &info, const double exitPrice,
                         const double profit, const double commission, const double swap,
                         const datetime closedAt, const double volume)
{
   int digits = (int)SymbolInfoInteger(info.symbol, SYMBOL_DIGITS);
   if(digits <= 0) digits = _Digits;

   string json = "{";
   json += "\"symbol\":\"" + EscapeJson(info.symbol) + "\",";
   json += "\"side\":\""   + info.side + "\",";
   json += "\"source\":\"mt5\",";
   json += "\"profit\":"     + DoubleToString(profit, 2) + ",";
   json += "\"entryPrice\":" + NumberOrNull(info.entryPrice, digits) + ",";
   json += "\"exitPrice\":"  + DoubleToString(exitPrice, digits) + ",";
   json += "\"stopLoss\":"   + NumberOrNull(info.stopLoss, digits) + ",";
   json += "\"takeProfit\":" + NumberOrNull(info.takeProfit, digits) + ",";
   json += "\"lotSize\":"    + DoubleToString(volume, 2) + ",";
   json += "\"commission\":" + DoubleToString(commission, 2) + ",";
   json += "\"swap\":"       + DoubleToString(swap, 2) + ",";
   json += "\"closedAt\":\"" + TimeToIso8601Utc(closedAt) + "\",";
   json += "\"notes\":\"MT5 EA \\u00b7 account #" + IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN)) + "\"";
   json += "}";

   string headers = "Content-Type: application/json\r\nX-Api-Key: " + InpApiKey + "\r\n";

   char postData[];
   int len = StringLen(json);
   ArrayResize(postData, len);
   StringToCharArray(json, postData, 0, len);

   char resultData[];
   string resultHeaders;

   ResetLastError();
   int status = WebRequest("POST", InpApiUrl, headers, InpTimeoutMs, postData, resultData, resultHeaders);

   if(status == -1)
   {
      int err = GetLastError();
      Print("QuantumJournalBridge: WebRequest failed (error ", err, "). ",
            "Add '", InpApiUrl, "' under Tools > Options > Expert Advisors > Allow WebRequest for listed URL.");
      return;
   }

   if(status >= 200 && status < 300)
   {
      Print("QuantumJournalBridge: logged ", info.symbol, " ", info.side,
            " P/L=", DoubleToString(profit, 2), " -> HTTP ", status);
   }
   else
   {
      Print("QuantumJournalBridge: server rejected trade, HTTP ", status,
            ": ", CharArrayToString(resultData));
   }
}

//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                         const MqlTradeRequest &request,
                         const MqlTradeResult &result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   if(!HistoryDealSelect(trans.deal)) return;

   ENUM_DEAL_TYPE dealType = (ENUM_DEAL_TYPE)HistoryDealGetInteger(trans.deal, DEAL_TYPE);
   if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL) return; // ignore balance/credit/etc.

   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   long positionId        = (long)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
   string symbol          = HistoryDealGetString(trans.deal, DEAL_SYMBOL);
   double dealPrice       = HistoryDealGetDouble(trans.deal, DEAL_PRICE);
   double dealVolume      = HistoryDealGetDouble(trans.deal, DEAL_VOLUME);

   if(entry == DEAL_ENTRY_IN)
   {
      OpenPositionInfo info;
      info.positionId = positionId;
      info.symbol     = symbol;
      info.side       = (dealType == DEAL_TYPE_BUY) ? "BUY" : "SELL";
      info.entryPrice = dealPrice;
      info.stopLoss   = 0;
      info.takeProfit = 0;
      if(PositionSelectByTicket(positionId))
      {
         info.stopLoss   = PositionGetDouble(POSITION_SL);
         info.takeProfit = PositionGetDouble(POSITION_TP);
      }
      StoreOpenPosition(info);
      return;
   }

   if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
   {
      double dealProfit     = HistoryDealGetDouble(trans.deal, DEAL_PROFIT);
      double dealCommission = HistoryDealGetDouble(trans.deal, DEAL_COMMISSION);
      double dealSwap       = HistoryDealGetDouble(trans.deal, DEAL_SWAP);
      datetime dealTime     = (datetime)HistoryDealGetInteger(trans.deal, DEAL_TIME);

      int idx = FindOpenPositionIndex(positionId);
      OpenPositionInfo info;
      if(idx >= 0)
      {
         info = g_openPositions[idx];
      }
      else
      {
         // The EA wasn't running when this position opened — log what we can.
         info.positionId = positionId;
         info.symbol     = symbol;
         info.side       = (dealType == DEAL_TYPE_SELL) ? "BUY" : "SELL"; // closing deal is opposite direction
         info.entryPrice = 0;
         info.stopLoss   = 0;
         info.takeProfit = 0;
      }

      SendTradeToJournal(info, dealPrice, dealProfit, dealCommission, dealSwap, dealTime, dealVolume);

      // Only stop tracking once the position is fully closed (not a partial close).
      if(idx >= 0 && !PositionSelectByTicket(positionId))
         RemoveOpenPositionAt(idx);
   }
}
//+------------------------------------------------------------------+
