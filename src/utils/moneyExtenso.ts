const UNITS = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
]
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function chunkToWords(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  if (n < 20) return UNITS[n]
  if (n < 100) {
    const ten = Math.floor(n / 10)
    const unit = n % 10
    return unit ? `${TENS[ten]} e ${UNITS[unit]}` : TENS[ten]
  }
  const hundred = Math.floor(n / 100)
  const rest = n % 100
  const head = HUNDREDS[hundred]
  if (!rest) return head
  return `${head} e ${chunkToWords(rest)}`
}

function integerToWords(n: number): string {
  if (n === 0) return 'zero'
  const parts: string[] = []
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  if (millions) {
    parts.push(millions === 1 ? 'um milhão' : `${chunkToWords(millions)} milhões`)
  }
  if (thousands) {
    parts.push(thousands === 1 ? 'mil' : `${chunkToWords(thousands)} mil`)
  }
  if (rest) parts.push(chunkToWords(rest))
  return parts.join(' e ')
}

export function moneyToExtenso(value: number): string {
  const safe = Math.max(0, Number(value) || 0)
  const reais = Math.floor(safe)
  const cents = Math.round((safe - reais) * 100)
  const reaisText = reais === 1 ? 'um real' : `${integerToWords(reais)} reais`
  if (cents <= 0) return reaisText
  const centsText = cents === 1 ? 'um centavo' : `${integerToWords(cents)} centavos`
  return `${reaisText} e ${centsText}`
}
