const CATALOG = {
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
          'application/json; charset=UTF-8',

        ...corsHeaders(origin)
      }
    }
  );
}


export default {

  async fetch(request, env) {

    const origin =
      request.headers.get('Origin') || '';


    /* CORS */

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


    /* Allowed website */

    if (
      !ALLOWED_ORIGINS.includes(origin)
    ) {

      return jsonResponse(
        {
          error:
            'Origin not allowed.',
          origin
        },

        403,

        origin
      );

    }


    /* Secret */

    if (
      !env.MERCADOPAGO_ACCESS_TOKEN
    ) {

      return jsonResponse(
        {
          error:
            'MERCADOPAGO_ACCESS_TOKEN is not configured.'
        },

        500,

        origin
      );

    }


    /* Read request body */

    let body;

    try {

      body =
        await request.json();

    } catch {

      return jsonResponse(
        {
          error:
            'Invalid JSON received.'
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
            'This checkout is currently configured for Brazil.'
        },

        400,

        origin
      );

    }


    const incomingItems =
      Array.isArray(body?.items)
        ? body.items
        : [];


    if (
      incomingItems.length === 0
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
     * Rebuild the cart from our own catalog.
     * Prices sent by the browser are ignored.
     */

    const items = [];


    for (
      const incoming of incomingItems
    ) {

      const id =
        String(
          incoming?.id || ''
        );


      const product =
        CATALOG[id];


      if (!product) {

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
              incoming?.quantity || 1
            ),

            1
          ),

          10
        );


      items.push({
        id,
        title:
          product.title,

        quantity,

        unit_price:
          product.price
      });

    }


    /*
     * Calculate subtotal.
     */

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
     * Validate coupon.
     */

    const requestedDiscount =
      Number(
        body?.discount || 0
      );


    const validDiscount =
      Object.values(COUPONS)
        .includes(requestedDiscount)
        ? requestedDiscount
        : 0;


    /*
     * For Mercado Pago we keep all line prices positive.
     * The coupon is applied proportionally to each item.
     */

    const mercadoPagoItems =
      items.map(
        item => {

          const discountedUnitPrice =
            Number(
              (
                item.unit_price *
                (1 - validDiscount)
              ).toFixed(2)
            );


          return {

            id:
              item.id,

            title:
              item.title,

            quantity:
              item.quantity,

            unit_price:
              discountedUnitPrice,

            currency_id:
              'BRL'

          };

        }
      );


    /*
     * Customer information.
     */

    const customer =
      body?.customer || {};


    const payer = {};


    if (
      customer.email
    ) {

      payer.email =
        String(
          customer.email
        ).trim();

    }


    /*
     * Create Mercado Pago preference.
     */

    const preference = {

      items:
        mercadoPagoItems,

      external_reference:
        `VENUS-${Date.now()}`,

      payer,

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


    let mercadoPagoResponse;


    try {

      mercadoPagoResponse =
        await fetch(
          'https://api.mercadopago.com/checkout/preferences',
          {

            method:
              'POST',

            headers: {

              'Authorization':
                `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,

              'Content-Type':
                'application/json',

              'Accept':
                'application/json'

            },

            body:
              JSON.stringify(
                preference
              )

          }
        );

    } catch (error) {

      return jsonResponse(
        {
          error:
            'Could not connect to Mercado Pago.',

          details:
            String(
              error?.message ||
              error
            )
        },

        502,

        origin
      );

    }


    /*
     * Read as text first.
     * This prevents:
     * Unexpected token '<'
     */

    const responseText =
      await mercadoPagoResponse.text();


    let mercadoPagoData;


    try {

      mercadoPagoData =
        JSON.parse(
          responseText
        );

    } catch {

      mercadoPagoData = {
        raw:
          responseText.slice(
            0,
            1000
          )
      };

    }


    /*
     * Mercado Pago rejected the preference.
     */

    if (
      !mercadoPagoResponse.ok
    ) {

      return jsonResponse(
        {
          error:
            'Mercado Pago rejected the checkout.',

          status:
            mercadoPagoResponse.status,

          details:
            mercadoPagoData
        },

        502,

        origin
      );

    }


    /*
     * Successful preference creation.
     */

    if (
      !mercadoPagoData?.init_point
    ) {

      return jsonResponse(
        {
          error:
            'Mercado Pago did not return init_point.',

          details:
            mercadoPagoData
        },

        502,

        origin
      );

    }


    return jsonResponse(
      {
        init_point:
          mercadoPagoData.init_point,

        preference_id:
          mercadoPagoData.id || null

      },

      200,

      origin
    );

  }

};
