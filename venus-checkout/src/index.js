const CATALOG = {
  br: {
    essencial: {
      title: 'Leitura Essencial',
      price: 50
    },

    venus: {
      title: 'Leitura Vênus',
      price: 100
    },

    caminhos: {
      title: 'Caminhos & Possibilidades',
      price: 160
    },

    amor: {
      title: 'Amor & Relações',
      price: 130
    },

    espiritual: {
      title: 'Direcionamento Espiritual',
      price: 130
    },

    completa: {
      title: 'Leitura Completa',
      price: 250
    }
  }
};


const COUPONS = {
  VENUS10: 0.10,
  BEMVINDA15: 0.15
};


const ALLOWED_ORIGINS = [
  'https://venusporthaianne.com',
  'https://www.venusporthaianne.com'
];


function corsHeaders(origin) {

  const allowedOrigin =
    ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];


  return {
    'Access-Control-Allow-Origin':
      allowedOrigin,

    'Access-Control-Allow-Methods':
      'POST, OPTIONS',

    'Access-Control-Allow-Headers':
      'Content-Type',

    'Vary':
      'Origin'
  };
}


function jsonResponse(
  data,
  status,
  origin
) {

  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        'Content-Type':
          'application/json',

        ...corsHeaders(origin)
      }
    }
  );
}


export default {

  async fetch(
    request,
    env
  ) {

    const origin =
      request.headers.get('Origin') || '';


    /* CORS preflight */

    if (
      request.method === 'OPTIONS'
    ) {

      return new Response(
        null,
        {
          status: 204,

          headers:
            corsHeaders(origin)
        }
      );

    }


    /* Only POST */

    if (
      request.method !== 'POST'
    ) {

      return jsonResponse(
        {
          error:
            'Method not allowed.'
        },

        405,

        origin
      );

    }


    /* Check origin */

    if (
      !ALLOWED_ORIGINS.includes(origin)
    ) {

      return jsonResponse(
        {
          error:
            'Origin not allowed.'
        },

        403,

        origin
      );

    }


    /* Check token */

    if (
      !env.MERCADOPAGO_ACCESS_TOKEN
    ) {

      return jsonResponse(
        {
          error:
            'Mercado Pago credentials are not configured.'
        },

        500,

        origin
      );

    }


    let body;


    try {

      body =
        await request.json();

    } catch {

      return jsonResponse(
        {
          error:
            'Invalid JSON.'
        },

        400,

        origin
      );

    }


    const country =
      body?.country;


    if (
      country !== 'br'
    ) {

      return jsonResponse(
        {
          error:
            'This checkout endpoint is currently configured for Brazil.'
        },

        400,

        origin
      );

    }


    const rawItems =
      Array.isArray(body?.items)
        ? body.items
        : [];


    if (
      rawItems.length === 0
    ) {

      return jsonResponse(
        {
          error:
            'Cart is empty.'
        },

        400,

        origin
      );

    }


    /*
     * Rebuild the order from OUR catalog.
     *
     * We intentionally do not trust the
     * prices sent by the browser.
     */

    const items = [];


    for (
      const rawItem of rawItems
    ) {

      const id =
        String(
          rawItem?.id || ''
        );


      const catalogItem =
        CATALOG.br[id];


      if (!catalogItem) {

        return jsonResponse(
          {
            error:
              `Unknown service: ${id}`
          },

          400,

          origin
        );

      }


      const quantity =
        Math.min(
          Math.max(
            Number(
              rawItem?.quantity || 1
            ),

            1
          ),

          10
        );


      items.push({

        id,

        title:
          catalogItem.title,

        quantity,

        unit_price:
          catalogItem.price

      });

    }


    /* Calculate subtotal */

    const subtotal =
      items.reduce(
        (sum, item) =>
          sum +
          (
            item.unit_price *
            item.quantity
          ),

        0
      );


    /*
     * Apply coupon server-side.
     * The browser is not trusted with
     * the final discount amount.
     */

    const requestedDiscount =
      Number(
        body?.discount || 0
      );


    const discount =
      (
        requestedDiscount >= 0 &&
        requestedDiscount <= 0.15
      )
        ? requestedDiscount
        : 0;


    const discountAmount =
      subtotal * discount;


    const total =
      subtotal -
      discountAmount;


    if (
      total <= 0
    ) {

      return jsonResponse(
        {
          error:
            'Invalid order total.'
        },

        400,

        origin
      );

    }


    /*
     * Mercado Pago items.
     *
     * To preserve the exact discounted total,
     * the discount is represented as a negative
     * item when a coupon is used.
     */

    const mercadoPagoItems =
      items.map(item => ({

        title:
          item.title,

        quantity:
          item.quantity,

        unit_price:
          item.unit_price,

        currency_id:
          'BRL'

      }));


    if (
      discountAmount > 0
    ) {

      mercadoPagoItems.push({

        title:
          'Desconto',

        quantity:
          1,

        unit_price:
          -Number(
            discountAmount.toFixed(2)
          ),

        currency_id:
          'BRL'

      });

    }


    /*
     * Optional customer data.
     * We use only what the checkout form sends.
     */

    const customer =
      body?.customer || {};


    const preferencePayload = {

      items:
        mercadoPagoItems,

      external_reference:
        `VENUS-${Date.now()}`,

      back_urls: {

        success:
          'https://venusporthaianne.com/?payment=success',

        failure:
          'https://venusporthaianne.com/?payment=failure',

        pending:
          'https://venusporthaianne.com/?payment=pending'

      },

      auto_return:
        'approved'

    };


    /*
     * Create Mercado Pago preference.
     */

    const mpResponse =
      await fetch(
        'https://api.mercadopago.com/checkout/preferences',

        {

          method:
            'POST',

          headers: {

            'Authorization':
              `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,

            'Content-Type':
              'application/json'

          },

          body:
            JSON.stringify(
              preferencePayload
            )

        }
      );


    const mpData =
      await mpResponse.json();


    if (
      !mpResponse.ok
    ) {

      console.error(
        'Mercado Pago error:',
        mpData
      );


      return jsonResponse(
        {
          error: 'Mercado Pago error.',
          details: mpData
        },
      
        502,
      
        origin
      );

    }


    if (
      !mpData.init_point
    ) {

      return jsonResponse(
        {
          error:
            'Mercado Pago did not return a checkout URL.'
        },

        502,

        origin
      );

    }


    return jsonResponse(
      {
        init_point:
          mpData.init_point,

        total:
          Number(
            total.toFixed(2)
          ),

        currency:
          'BRL'
      },

      200,

      origin
    );

  }

};
