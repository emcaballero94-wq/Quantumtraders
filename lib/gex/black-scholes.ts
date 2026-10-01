// Standard Black-Scholes-Merton pricing/greeks with a continuous dividend
// yield — textbook formulas (Hull, "Options, Futures and Other Derivatives"),
// implemented from scratch here, not copied from any particular project.

export type OptionType = 'call' | 'put'

export interface GreeksInput {
  spot: number
  strike: number
  yearsToExpiry: number
  iv: number
  riskFreeRate: number
  dividendYield: number
  optionType: OptionType
}

export interface Greeks {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

// Abramowitz & Stegun 7.1.26 approximation — accurate to ~1.5e-7, more than
// enough precision for option greeks.
function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * absX)
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
      Math.exp(-absX * absX)
  return 0.5 * (1 + sign * y)
}

export function blackScholesGreeks(input: GreeksInput): Greeks {
  const { spot, strike, yearsToExpiry, iv, riskFreeRate, dividendYield, optionType } = input
  if (spot <= 0 || strike <= 0 || yearsToExpiry <= 0 || iv <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 }
  }

  const sqrtT = Math.sqrt(yearsToExpiry)
  const d1 = (Math.log(spot / strike) + (riskFreeRate - dividendYield + (iv * iv) / 2) * yearsToExpiry) / (iv * sqrtT)
  const d2 = d1 - iv * sqrtT
  const pdfD1 = normPdf(d1)
  const discount = Math.exp(-riskFreeRate * yearsToExpiry)
  const carryDiscount = Math.exp(-dividendYield * yearsToExpiry)

  const gamma = (carryDiscount * pdfD1) / (spot * iv * sqrtT)
  const vega = (spot * carryDiscount * pdfD1 * sqrtT) / 100

  let delta: number
  let theta: number
  let rho: number

  if (optionType === 'call') {
    delta = carryDiscount * normCdf(d1)
    theta =
      (-(spot * carryDiscount * pdfD1 * iv) / (2 * sqrtT) -
        riskFreeRate * strike * discount * normCdf(d2) +
        dividendYield * spot * carryDiscount * normCdf(d1)) /
      365
    rho = (strike * yearsToExpiry * discount * normCdf(d2)) / 100
  } else {
    delta = carryDiscount * (normCdf(d1) - 1)
    theta =
      (-(spot * carryDiscount * pdfD1 * iv) / (2 * sqrtT) +
        riskFreeRate * strike * discount * normCdf(-d2) -
        dividendYield * spot * carryDiscount * normCdf(-d1)) /
      365
    rho = (-strike * yearsToExpiry * discount * normCdf(-d2)) / 100
  }

  return { delta, gamma, theta, vega, rho }
}

export function blackScholesPrice(input: GreeksInput): number {
  const { spot, strike, yearsToExpiry, iv, riskFreeRate, dividendYield, optionType } = input
  if (spot <= 0 || strike <= 0 || yearsToExpiry <= 0 || iv <= 0) return 0

  const sqrtT = Math.sqrt(yearsToExpiry)
  const d1 = (Math.log(spot / strike) + (riskFreeRate - dividendYield + (iv * iv) / 2) * yearsToExpiry) / (iv * sqrtT)
  const d2 = d1 - iv * sqrtT
  const discount = Math.exp(-riskFreeRate * yearsToExpiry)
  const carryDiscount = Math.exp(-dividendYield * yearsToExpiry)

  if (optionType === 'call') {
    return spot * carryDiscount * normCdf(d1) - strike * discount * normCdf(d2)
  }
  return strike * discount * normCdf(-d2) - spot * carryDiscount * normCdf(-d1)
}

const IV_FLOOR = 1e-4
const IV_CEILING = 5.0
const IV_NEWTON_STEPS = 12
const IV_BISECTION_STEPS = 60
const IV_MIN_VEGA = 1e-8
const IV_PRICE_TOLERANCE = 1e-6

function clampIv(iv: number): number {
  return Math.min(IV_CEILING, Math.max(IV_FLOOR, iv))
}

// Solves for implied volatility from an observed option price via
// Newton-Raphson, falling back to bisection when vega is too small for a
// Newton step to be reliable (deep ITM/OTM, or very close to expiry). Returns
// null when the price can't be explained by any volatility in [0.01%, 500%]
// — e.g. a price below intrinsic value, or bad/stale input data.
export function solveImpliedVolatility(price: number, params: Omit<GreeksInput, 'iv'>): number | null {
  const { spot, strike, yearsToExpiry, riskFreeRate, dividendYield, optionType } = params
  if (price <= 0 || spot <= 0 || strike <= 0 || yearsToExpiry <= 0) return null

  let guess = 0.5
  for (let i = 0; i < IV_NEWTON_STEPS; i += 1) {
    const modelPrice = blackScholesPrice({ spot, strike, yearsToExpiry, iv: guess, riskFreeRate, dividendYield, optionType })
    const diff = modelPrice - price
    if (Math.abs(diff) < IV_PRICE_TOLERANCE) return clampIv(guess)

    const rawVega = blackScholesGreeks({ spot, strike, yearsToExpiry, iv: guess, riskFreeRate, dividendYield, optionType }).vega * 100
    if (!Number.isFinite(rawVega) || rawVega < IV_MIN_VEGA) break

    const next = guess - diff / rawVega
    if (!Number.isFinite(next) || next <= 0) break
    guess = next
  }

  // Bisection fallback for the cases Newton couldn't settle.
  const priceAt = (iv: number) =>
    blackScholesPrice({ spot, strike, yearsToExpiry, iv, riskFreeRate, dividendYield, optionType })

  let low = IV_FLOOR
  let high = IV_CEILING
  const priceLow = priceAt(low)
  const priceHigh = priceAt(high)
  if ((priceLow - price) * (priceHigh - price) > 0) return null // price unreachable anywhere in range

  for (let i = 0; i < IV_BISECTION_STEPS; i += 1) {
    const mid = (low + high) / 2
    const diff = priceAt(mid) - price
    if (Math.abs(diff) < IV_PRICE_TOLERANCE) return clampIv(mid)
    if ((priceAt(low) - price) * diff < 0) high = mid
    else low = mid
  }
  return clampIv((low + high) / 2)
}
