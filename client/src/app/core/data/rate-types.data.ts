export interface RateFaq {
  question: string;
  answer: string;
}

export interface RateTypeContent {
  slug: string;
  apiType: string;
  label: string;
  shortLabel: string;
  lowerLabel: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  howToBuy: { title: string; steps: string[] } | null;
  legal: string;
  taxes: string | null;
  audience: string;
  faqs: RateFaq[];
  related: string[];
  chartColor: string;
}

export const RATE_TYPES: RateTypeContent[] = [
  {
    slug: 'dolar-blue',
    apiType: 'blue',
    label: 'Dólar Blue',
    shortLabel: 'Blue',
    lowerLabel: 'dólar blue',
    tagline: 'La cotización del dólar en el mercado informal',
    metaTitle: 'Dólar Blue Hoy: Cotización en Vivo | Dólar en Vivo',
    metaDescription:
      'Cotización del dólar blue hoy en Argentina, actualizada en vivo. Precio de compra y venta, brecha con el oficial, histórico y preguntas frecuentes.',
    intro: [
      'El dólar blue es el precio al que se compra y vende el dólar estadounidense fuera del circuito bancario formal en Argentina. También se lo conoce como dólar paralelo, dólar informal o dólar negro: son todos el mismo tipo de cambio.',
      'Su cotización no la fija el Banco Central sino la oferta y la demanda en las llamadas "cuevas" y arbolitos. Por eso reacciona mucho más rápido que el dólar oficial ante cambios en la expectativa económica, y suele ser el termómetro que más se mira cuando hay incertidumbre.',
      'La diferencia porcentual entre el blue y el oficial se llama brecha cambiaria, y es uno de los indicadores más seguidos de la economía argentina: cuanto más se amplía, más tensión cambiaria refleja.',
    ],
    howToBuy: null,
    legal:
      'La compraventa de dólares en el mercado informal no está regulada ni respaldada por el Banco Central, y opera al margen del sistema financiero formal. No existe comprobante bancario de la operación ni garantía sobre la autenticidad de los billetes. Las alternativas legales para dolarizarse son el dólar oficial (con los límites vigentes), el dólar MEP y el dólar CCL, todos operados a través de entidades reguladas.',
    taxes: null,
    audience:
      'Es la referencia más consultada por el público general, sobre todo por quienes no pueden acceder al cupo del dólar oficial o buscan operar montos chicos sin pasar por el sistema bancario.',
    faqs: [
      {
        question: '¿El dólar blue es lo mismo que el dólar paralelo o informal?',
        answer:
          'Sí. Dólar blue, dólar paralelo, dólar informal y dólar negro son distintos nombres para la misma cotización: el precio del dólar fuera del circuito oficial.',
      },
      {
        question: '¿Por qué el dólar blue es más caro que el oficial?',
        answer:
          'Porque el acceso al dólar oficial está limitado por cupos y restricciones. Cuando la demanda de dólares supera lo que el mercado formal permite comprar, el excedente se vuelca al mercado informal y empuja su precio por encima del oficial.',
      },
      {
        question: '¿Qué es la brecha cambiaria?',
        answer:
          'Es la diferencia porcentual entre el dólar blue y el dólar oficial. Se calcula como (blue − oficial) / oficial × 100. Una brecha alta indica mayor tensión cambiaria y expectativa de devaluación.',
      },
      {
        question: '¿A qué hora se actualiza el dólar blue?',
        answer:
          'El mercado informal opera aproximadamente de 10 a 17 horas en días hábiles. Fuera de ese horario y los fines de semana la cotización queda estable en el último valor operado.',
      },
    ],
    related: ['dolar-oficial', 'dolar-mep', 'dolar-cripto'],
    chartColor: '#3b82f6',
  },
  {
    slug: 'dolar-oficial',
    apiType: 'oficial',
    label: 'Dólar Oficial',
    shortLabel: 'Oficial',
    lowerLabel: 'dólar oficial',
    tagline: 'El tipo de cambio del Banco Nación',
    metaTitle: 'Dólar Oficial Hoy: Cotización Banco Nación | Dólar en Vivo',
    metaDescription:
      'Cotización del dólar oficial hoy en Argentina según el Banco Nación. Precio de compra y venta actualizado en vivo, histórico y diferencia con el blue.',
    intro: [
      'El dólar oficial es el tipo de cambio regulado por el Banco Central de la República Argentina y el que publican los bancos para operaciones formales. La referencia más usada es la del Banco de la Nación Argentina.',
      'Es el tipo de cambio que se aplica al comercio exterior, a las operaciones bancarias y como base de cálculo para los dólares con impuestos (como el dólar tarjeta o dólar ahorro). Al estar administrado, su variación es mucho más gradual y previsible que la del blue.',
      'La cotización tiene dos valores: el precio de compra (al que el banco te compra dólares) y el de venta (al que te los vende). La diferencia entre ambos es el spread de la entidad.',
    ],
    howToBuy: {
      title: 'Cómo comprar dólar oficial',
      steps: [
        'Tener una cuenta bancaria en pesos y una caja de ahorro en dólares en la misma entidad.',
        'Ingresar al home banking o app del banco, en la sección de compra de moneda extranjera.',
        'Verificar que cumplís los requisitos vigentes y que tenés cupo disponible en el mes.',
        'Confirmar la operación: los pesos se debitan y los dólares se acreditan en tu caja de ahorro en dólares.',
      ],
    },
    legal:
      'Es la vía formal y plenamente legal para comprar dólares en Argentina. El acceso está sujeto a los requisitos y límites que fija el Banco Central, que pueden cambiar con el tiempo e incluyen condiciones sobre la situación laboral, la percepción de subsidios y la tenencia de otros instrumentos. Conviene verificar las condiciones vigentes con tu banco antes de operar.',
    taxes:
      'Según el destino de la operación, al dólar oficial pueden sumársele percepciones impositivas que elevan el precio final: es el caso del dólar tarjeta, aplicado a consumos con tarjeta en el exterior y a servicios digitales. El valor que se muestra en esta página es el tipo de cambio de referencia sin esos recargos.',
    audience:
      'Lo usan quienes pueden acceder al cupo mensual, empresas que operan comercio exterior, y sirve de base para calcular el dólar tarjeta y otros tipos de cambio con impuestos.',
    faqs: [
      {
        question: '¿Cuál es la diferencia entre el dólar oficial y el dólar blue?',
        answer:
          'El dólar oficial es el tipo de cambio regulado que operan los bancos, con acceso limitado por cupos. El blue es el precio en el mercado informal, sin límites de monto pero fuera del sistema financiero formal. El blue suele cotizar por encima del oficial.',
      },
      {
        question: '¿Qué diferencia hay entre el precio de compra y el de venta?',
        answer:
          'El precio de compra es al que el banco te compra tus dólares, y el de venta es al que te los vende. Siempre vas a comprar más caro y vender más barato: esa diferencia es la ganancia de la entidad.',
      },
      {
        question: '¿El dólar oficial es lo mismo que el dólar tarjeta?',
        answer:
          'No. El dólar tarjeta parte del dólar oficial pero le suma percepciones impositivas, por lo que resulta bastante más caro. El oficial es la base de cálculo, no el precio final que se paga en consumos en el exterior.',
      },
    ],
    related: ['dolar-blue', 'dolar-mep', 'dolar-ccl'],
    chartColor: '#22c55e',
  },
  {
    slug: 'dolar-mep',
    apiType: 'mep',
    label: 'Dólar MEP',
    shortLabel: 'MEP',
    lowerLabel: 'dólar MEP',
    tagline: 'Dólar Bolsa: dolarizarse legalmente vía mercado de capitales',
    metaTitle: 'Dólar MEP Hoy: Cotización y Cómo Comprarlo | Dólar en Vivo',
    metaDescription:
      'Cotización del dólar MEP hoy, actualizada en vivo. Qué es el dólar bolsa, cómo comprarlo paso a paso, diferencias con el CCL y el blue.',
    intro: [
      'El dólar MEP, también llamado dólar bolsa, es el tipo de cambio que surge de comprar un título o bono en pesos en el mercado local y venderlo en dólares. El nombre viene de "Mercado Electrónico de Pagos".',
      'Es una vía completamente legal para dolarizarse a través del mercado de capitales, sin los cupos que limitan la compra de dólar oficial. Los dólares resultantes quedan acreditados en tu cuenta comitente y pueden transferirse a una cuenta bancaria en dólares en Argentina.',
      'Su cotización se calcula dividiendo el precio en pesos del título por su precio en dólares. Por eso no es un valor "fijado" sino uno que emerge del mercado, y puede variar levemente según el bono que se use para la operación.',
    ],
    howToBuy: {
      title: 'Cómo comprar dólar MEP paso a paso',
      steps: [
        'Abrir una cuenta comitente en un broker (ALyC) o usar la sección de inversiones de tu banco.',
        'Transferir los pesos desde tu cuenta bancaria a la cuenta comitente.',
        'Comprar un bono que cotice en pesos y en dólares, típicamente AL30 o GD30.',
        'Esperar el plazo de liquidación correspondiente (el llamado "parking", si aplica en ese momento).',
        'Vender el mismo bono en su especie en dólares (por ejemplo AL30D o GD30D).',
        'Retirar los dólares a tu cuenta bancaria en dólares o dejarlos invertidos.',
      ],
    },
    legal:
      'Es una operación totalmente legal y regulada, realizada a través de agentes autorizados por la Comisión Nacional de Valores. A diferencia del dólar oficial, no está sujeta a cupo mensual, aunque sí pueden existir restricciones sobre operar MEP y dólar oficial de forma simultánea. Los dólares obtenidos son "dólares blancos", con respaldo documental de la operación.',
    taxes:
      'La operación no paga el impuesto PAIS ni percepciones a cuenta de Ganancias que sí aplican a otros tipos de cambio. Sí pueden aplicarse comisiones del broker y, según la jurisdicción, el impuesto a los ingresos brutos sobre la operatoria bursátil.',
    audience:
      'Es la opción preferida por ahorristas que quieren dolarizar montos medianos o grandes de forma legal y documentada, sin depender del cupo del dólar oficial.',
    faqs: [
      {
        question: '¿Qué diferencia hay entre el dólar MEP y el dólar CCL?',
        answer:
          'Ambos se operan comprando y vendiendo títulos, pero el MEP deja los dólares en una cuenta local en Argentina, mientras que el CCL los deposita en una cuenta en el exterior. Por eso el CCL suele cotizar un poco más caro: incluye el costo de girar los fondos afuera.',
      },
      {
        question: '¿Es legal comprar dólar MEP?',
        answer:
          'Sí. Es una operación bursátil realizada a través de agentes regulados por la Comisión Nacional de Valores, con respaldo documental completo. Los dólares obtenidos son legales y declarables.',
      },
      {
        question: '¿Hay límite de monto para comprar dólar MEP?',
        answer:
          'No existe un cupo mensual como el del dólar oficial. Sin embargo, pueden regir restricciones sobre operar MEP en simultáneo con la compra de dólar oficial, así que conviene verificar la normativa vigente con tu broker.',
      },
      {
        question: '¿Qué es el parking?',
        answer:
          'Es un plazo mínimo de tenencia que en algunos períodos la regulación exige mantener entre la compra del bono en pesos y su venta en dólares. Cuando rige, la operación no puede completarse en el mismo día.',
      },
    ],
    related: ['dolar-ccl', 'dolar-blue', 'dolar-oficial'],
    chartColor: '#a855f7',
  },
  {
    slug: 'dolar-ccl',
    apiType: 'ccl',
    label: 'Dólar CCL',
    shortLabel: 'CCL',
    lowerLabel: 'dólar CCL',
    tagline: 'Contado con Liquidación: dólares en el exterior',
    metaTitle: 'Dólar CCL Hoy: Cotización Contado con Liqui | Dólar en Vivo',
    metaDescription:
      'Cotización del dólar CCL o contado con liquidación hoy, en vivo. Qué es, cómo se opera, diferencias con el dólar MEP y para qué se usa.',
    intro: [
      'El dólar CCL —contado con liquidación, o simplemente "contado con liqui"— es el tipo de cambio que resulta de comprar un activo en pesos en Argentina y venderlo en dólares en un mercado del exterior.',
      'La diferencia clave con el dólar MEP es dónde terminan los dólares: el CCL los deposita en una cuenta bancaria fuera del país, mientras que el MEP los deja en una cuenta local. Esa capacidad de girar fondos al exterior es la razón de su existencia.',
      'Suele cotizar levemente por encima del MEP, ya que incorpora el costo implícito de transferir los fondos afuera. La brecha entre ambos se sigue de cerca como señal de la demanda por sacar capital del país.',
    ],
    howToBuy: {
      title: 'Cómo se opera el dólar CCL',
      steps: [
        'Contar con una cuenta comitente local y una cuenta bancaria o de inversión en el exterior.',
        'Transferir los pesos a la cuenta comitente en Argentina.',
        'Comprar un activo que cotice en ambas plazas, como bonos soberanos o CEDEARs.',
        'Solicitar al broker la venta del activo en el mercado externo, en dólares.',
        'Los dólares se acreditan en la cuenta del exterior indicada.',
      ],
    },
    legal:
      'Es una operación legal realizada a través de agentes regulados por la Comisión Nacional de Valores. Requiere declarar la cuenta del exterior de destino y, por su naturaleza, suele estar sujeta a mayores controles y a restricciones cruzadas con el acceso al dólar oficial. Conviene confirmar las condiciones vigentes con el broker antes de operar.',
    taxes:
      'Como toda operatoria bursátil, puede estar alcanzada por comisiones del agente e ingresos brutos según la jurisdicción. Al tratarse de fondos girados al exterior, exige especial atención al cumplimiento de las obligaciones informativas ante la AFIP.',
    audience:
      'Lo usan principalmente empresas que necesitan girar fondos al exterior, inversores que operan en mercados internacionales y quienes buscan mantener sus ahorros fuera del sistema financiero local.',
    faqs: [
      {
        question: '¿Qué significa contado con liquidación?',
        answer:
          'Es una operación en la que se compra un activo en pesos en el mercado local y se lo vende en dólares en un mercado del exterior, obteniendo así divisas depositadas fuera del país. El tipo de cambio implícito de esa operación es el dólar CCL.',
      },
      {
        question: '¿Por qué el CCL es más caro que el MEP?',
        answer:
          'Porque incluye el costo de transferir los fondos al exterior. El MEP deja los dólares en una cuenta local, mientras que el CCL los gira afuera, y esa demanda adicional se refleja en un precio algo mayor.',
      },
      {
        question: '¿Se puede operar CCL con CEDEARs?',
        answer:
          'Sí. Los CEDEARs son uno de los instrumentos habituales para la operatoria, junto con los bonos soberanos, ya que cotizan tanto en el mercado local como en el exterior.',
      },
    ],
    related: ['dolar-mep', 'dolar-blue', 'dolar-cripto'],
    chartColor: '#ec4899',
  },
  {
    slug: 'dolar-cripto',
    apiType: 'cripto',
    label: 'Dólar Cripto',
    shortLabel: 'Cripto',
    lowerLabel: 'dólar cripto',
    tagline: 'El dólar según las stablecoins',
    metaTitle: 'Dólar Cripto Hoy: Cotización USDT y Stablecoins | Dólar en Vivo',
    metaDescription:
      'Cotización del dólar cripto hoy en Argentina, en vivo. Precio del dólar según stablecoins como USDT y USDC, cómo comprarlo y en qué se diferencia del blue.',
    intro: [
      'El dólar cripto es el tipo de cambio que surge de comprar stablecoins —criptomonedas atadas al valor del dólar, como USDT o USDC— pagando en pesos argentinos.',
      'A diferencia del resto de los tipos de cambio, opera las 24 horas de los 7 días de la semana, incluidos fines de semana y feriados. Por eso suele ser la primera referencia disponible cuando ocurre algo relevante fuera del horario bancario.',
      'Su cotización se forma en los exchanges de criptomonedas, donde la oferta y demanda de stablecoins contra pesos determina el precio. Al no depender del horario del mercado local, muchas veces anticipa el movimiento que después replican el blue y el MEP.',
    ],
    howToBuy: {
      title: 'Cómo comprar dólar cripto',
      steps: [
        'Crear una cuenta en un exchange de criptomonedas y completar la verificación de identidad.',
        'Transferir pesos desde tu cuenta bancaria o billetera virtual al exchange.',
        'Comprar una stablecoin como USDT o USDC con esos pesos.',
        'Mantener los fondos en el exchange o transferirlos a una billetera propia para mayor control.',
      ],
    },
    legal:
      'La compra de stablecoins a través de exchanges registrados es legal en Argentina. Las tenencias en criptomonedas deben declararse ante la AFIP como cualquier otro activo. Es importante tener presente que las stablecoins conllevan riesgos propios: dependen de la solvencia del emisor que respalda la paridad con el dólar y de la seguridad de la plataforma donde se custodian.',
    taxes:
      'La compraventa de criptomonedas puede estar alcanzada por el impuesto a las ganancias sobre los resultados obtenidos y, según la jurisdicción, por ingresos brutos. Además, las tenencias deben incluirse en la declaración de bienes personales cuando corresponda.',
    audience:
      'Lo usan quienes quieren dolarizarse fuera del horario bancario, personas que reciben pagos del exterior en cripto y usuarios que buscan mover valor rápido sin pasar por el sistema financiero tradicional.',
    faqs: [
      {
        question: '¿Qué es una stablecoin?',
        answer:
          'Es una criptomoneda diseñada para mantener una paridad estable con una moneda tradicional, generalmente el dólar estadounidense. Las más usadas son USDT (Tether) y USDC. A diferencia del Bitcoin, su precio no fluctúa: un USDT busca valer siempre un dólar.',
      },
      {
        question: '¿El dólar cripto opera los fines de semana?',
        answer:
          'Sí. Es el único tipo de cambio que funciona las 24 horas, todos los días del año, porque los exchanges de criptomonedas no cierran. Por eso suele ser la referencia disponible cuando el resto del mercado está cerrado.',
      },
      {
        question: '¿Es lo mismo el dólar cripto que el dólar blue?',
        answer:
          'No, aunque sus valores suelen ser parecidos. El dólar cripto surge de la compra de stablecoins en exchanges, mientras que el blue es el precio de los billetes físicos en el mercado informal. El cripto opera de forma digital, permanente y a través de plataformas identificadas.',
      },
    ],
    related: ['dolar-blue', 'dolar-mep', 'dolar-ccl'],
    chartColor: '#f59e0b',
  },
];

export const RATE_TYPE_BY_SLUG = new Map(RATE_TYPES.map((r) => [r.slug, r]));

export function rateTypeBySlug(slug: string): RateTypeContent | undefined {
  return RATE_TYPE_BY_SLUG.get(slug);
}
