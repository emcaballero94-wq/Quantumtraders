# QuantumJournalBridge — Expert Advisor para MetaTrader 5

Envía automáticamente cada operación cerrada en MT5 al Trade Journal de Quantum
Traders OS (`/dashboard/tools`), sin tener que registrarla a mano.

## Cómo funciona

- Se conecta al evento `OnTradeTransaction` de MT5, que se dispara con cada
  operación (deal) en la cuenta — no solo en el símbolo del gráfico donde está
  el EA. **Basta con ponerlo en un solo gráfico** para capturar todas las
  operaciones de la cuenta.
- Cuando una posición se abre, guarda su precio de entrada, SL/TP y dirección
  en memoria.
- Cuando se cierra (total o parcialmente), arma el registro con esos datos +
  precio de salida, profit, comisión y swap del deal de cierre, y lo envía por
  HTTP (`WebRequest`) a `POST /api/journal/trades` con `source: "mt5"`.
- Un cierre parcial genera su propia entrada en el diario (por el volumen
  cerrado en ese momento); la posición sigue rastreada hasta que se cierra del
  todo.

## Instalación

1. **Copia el archivo**: `QuantumJournalBridge.mq5` → carpeta `MQL5/Experts/`
   de tu instalación de MetaTrader 5 (Archivo → Abrir carpeta de datos →
   `MQL5/Experts`).
2. **Compílalo** en MetaEditor (F7). No tiene dependencias externas.
3. **Autoriza la URL** — MT5 bloquea `WebRequest` a cualquier dominio no
   autorizado explícitamente:
   - Herramientas → Opciones → pestaña "Asesores Expertos"
   - Marca "Permitir WebRequest para las URL listadas"
   - Agrega: `https://emmanuelcaballero.com`
4. **Arrastra el EA** a cualquier gráfico abierto (uno solo es suficiente).
5. En las propiedades del EA, configura:
   - `InpApiUrl`: déjalo como está, salvo que uses otro dominio.
   - `InpApiKey`: el mismo valor que pongas en la variable de entorno
     `MT5_JOURNAL_API_KEY` del servidor (ver abajo).
6. Confirma que "Permitir Trading algorítmico" esté activado (el botón
   correspondiente en la barra de herramientas de MT5).

## Configuración del lado del servidor

En Vercel (ambos proyectos, `project-t77st` y `quantumtraders`, o solo el de
producción real), agrega la variable de entorno:

```
MT5_JOURNAL_API_KEY=<un secreto largo y aleatorio, elegido por ti>
```

Sin esta variable configurada, el servidor rechaza cualquier trade con
`source: "mt5"` (responde 503) — es una protección para que nadie pueda
insertar operaciones falsas en tu diario sin conocer el secreto.

## Verificación

- En MT5, pestaña "Expertos" (log), deberías ver una línea por cada trade
  cerrado: `QuantumJournalBridge: logged SPX500 BUY P/L=12.50 -> HTTP 201`.
- Si ves `WebRequest failed`, revisa el paso 3 (URL no autorizada).
- Si ves `HTTP 401`, el `InpApiKey` no coincide con `MT5_JOURNAL_API_KEY`.
- Si ves `HTTP 503`, falta configurar `MT5_JOURNAL_API_KEY` en el servidor.
- El trade debería aparecer en `/dashboard/tools` (Trade Audit) en segundos.

## Limitaciones conocidas

- **Hora**: MT5 marca las operaciones con la hora del servidor del bróker, no
  UTC. El EA aplica una corrección aproximada (`TimeGMT() - TimeTradeServer()`)
  que funciona bien en la mayoría de los casos, pero no es exacta al segundo
  para todos los brókers.
- **Histórico**: el EA solo captura trades que ocurren mientras está corriendo
  en la terminal. No importa operaciones pasadas — para eso sigue disponible
  el registro manual en `/dashboard/tools`.
- **Cuenta demo vs. real**: funciona igual en ambas; solo cambia a qué cuenta
  está conectada tu terminal.
