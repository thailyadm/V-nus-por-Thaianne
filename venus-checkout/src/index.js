const CATALOG = {
  essencial: {
    title: 'Leitura Essencial',
    brPrice: 50,
    usPrice: 15
  },

  venus: {
    title: 'Leitura Vênus',
    brPrice: 100,
    usPrice: 25
  },

  caminhos: {
    title: 'Caminhos & Possibilidades',
    brPrice: 160,
    usPrice: 35
  },

  amor: {
    title: 'Amor & Relações',
    brPrice: 130,
    usPrice: 30
  },

  espiritual: {
    title: 'Direcionamento Espiritual',
    brPrice: 130,
    usPrice: 30
  },

  completa: {
    title: 'Leitura Completa',
    brPrice: 250,
    usPrice: 45
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
      'GET, POST, OPTIONS',

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


async function getPayPalAccessToken(env) {

  if (
    !env.PAYPAL_CLIENT_ID ||
    !env.PAYPAL_CLIENT_SECRET
  ) {

    throw new Error(
      'PayPal credentials are missing.'
    );

  }


  const credentials =
    btoa(
      `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
    );


  const response =
    await fetch(
      'https://api-m.paypal.com',
      {

        method:
          'POST',

        headers: {

          'Authorization':
            `Basic ${credentials}`,

          'Content-Type':
            'application/x-www-form-urlencoded',

          'Accept':
            'application/json'

        },

        body:
          'grant_type=client_credentials'

      }
    );


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      raw:
        text.slice(0, 2000)
    };

  }


  if (!response.ok) {

    throw new Error(
      `PayPal authentication failed (${response.status}).`
    );

  }


  if (!data.access_token) {

    throw new Error(
      'PayPal did not return an access token.'
    );

  }


  return data.access_token;
}


function buildBrazilItems(body) {

  const incoming =
    Array.isArray(body?.items)
      ? body.items
      : [];


  if (!incoming.length) {

    throw new Error(
      'Cart is empty or invalid.'
    );

  }


  const items = [];


  for (
    const entry of incoming
  ) {

    const id =
      String(
        entry?.id || ''
      );


    const catalogItem =
      CATALOG[id];


    if (!catalogItem) {

      throw new Error(
        `Unknown service: ${id}`
      );

    }


    const quantity =
      Math.max(
        1,
        Math.min(
          10,
          Number(
            entry?.quantity || 1
          )
        )
      );


    items.push({

      id,

      title:
        catalogItem.title,

      quantity,

      unit_price:
        catalogItem.brPrice

    });

  }


  return items;
}


function buildUSItems(body) {

  const incoming =
    Array.isArray(body?.items)
      ? body.items
      : [];


  if (!incoming.length) {

    throw new Error(
      'Cart is empty or invalid.'
    );

  }


  const items = [];


  for (
    const entry of incoming
  ) {

    const id =
      String(
        entry?.id || ''
      );


    const catalogItem =
      CATALOG[id];


    if (!catalogItem) {

      throw new Error(
        `Unknown service: ${id}`
      );

    }


    const quantity =
      Math.max(
        1,
        Math.min(
          10,
          Number(
            entry?.quantity || 1
          )
        )
      );


    items.push({

      id,

      title:
        catalogItem.title,

      quantity,

      unit_price:
        catalogItem.usPrice

    });

  }


  return items;
}


function calculateSubtotal(items) {

  return items.reduce(

    (sum, item) =>
      sum +
      (
        item.unit_price *
        item.quantity
      ),

    0

  );

}


function getValidDiscount(value) {

  const requested =
    Number(value || 0);


  return Object.values(
    COUPONS
  ).includes(requested)

    ? requested

    : 0;

}


/*
 * MERCADO PAGO - BRAZIL
 */

async function createMercadoPagoCheckout(
  body,
  env
) {

  if (
    !env.MERCADOPAGO_ACCESS_TOKEN
  ) {

    throw new Error(
      'MERCADOPAGO_ACCESS_TOKEN is missing.'
    );

  }


  const items =
    buildBrazilItems(body);


  const subtotal =
    calculateSubtotal(items);


  const discount =
    getValidDiscount(
      body?.discount
    );


  const mercadoPagoItems =
    items.map(
      item => {

        const discountedUnitPrice =
          Number(
            (
              item.unit_price *
              (1 - discount)
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


  const email =
    String(
      body?.customer?.email || ''
    ).trim();


  const preference = {

    items:
      mercadoPagoItems,

    external_reference:
      `VENUS-BR-${Date.now()}`,

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


  if (email) {

    preference.payer = {
      email
    };

  }


  const response =
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


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      raw:
        text.slice(0, 2000)
    };

  }


  if (!response.ok) {

    throw new Error(
      `Mercado Pago rejected the checkout (${response.status}).`
    );

  }


  const checkoutUrl =
    data?.init_point ||
    data?.sandbox_init_point;


  if (!checkoutUrl) {

    throw new Error(
      'Mercado Pago did not return a checkout URL.'
    );

  }


  return {

    init_point:
      checkoutUrl,

    provider:
      'mercadopago',

    subtotal:
      Number(
        subtotal.toFixed(2)
      ),

    discount,

    total:
      Number(
        (
          subtotal *
          (1 - discount)
        ).toFixed(2)
      )

  };

}


/*
 * PAYPAL - CREATE ORDER
 */

async function createPayPalOrder(
  body,
  env
) {

  const items =
    buildUSItems(body);


  const subtotal =
    calculateSubtotal(items);


  const discount =
    getValidDiscount(
      body?.discount
    );


  const total =
    Number(
      (
        subtotal *
        (1 - discount)
      ).toFixed(2)
    );


  if (
    total <= 0
  ) {

    throw new Error(
      'Invalid PayPal order total.'
    );

  }


  const paypalItems =
    items.map(
      item => {

        const discountedUnitPrice =
          Number(
            (
              item.unit_price *
              (1 - discount)
            ).toFixed(2)
          );


        return {

          name:
            item.title,

          quantity:
            String(
              item.quantity
            ),

          unit_amount: {

            currency_code:
              'USD',

            value:
              discountedUnitPrice.toFixed(2)

          }

        };

      }
    );


  const accessToken =
    await getPayPalAccessToken(
      env
    );


  const orderPayload = {

    intent:
      'CAPTURE',

    purchase_units: [

      {

        reference_id:
          `VENUS-US-${Date.now()}`,

        description:
          'Vênus by Thaianne Tarot Reading',

        amount: {

          currency_code:
            'USD',

          value:
            total.toFixed(2),

          breakdown: {

            item_total: {

              currency_code:
                'USD',

              value:
                total.toFixed(2)

            }

          }

        },

        items:
          paypalItems

      }

    ]

  };


  const response =
    await fetch(
      'https://api-m.paypal.com',
      {

        method:
          'POST',

        headers: {

          'Authorization':
            `Bearer ${accessToken}`,

          'Content-Type':
            'application/json',

          'Accept':
            'application/json'

        },

        body:
          JSON.stringify(
            orderPayload
          )

      }
    );


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      raw:
        text.slice(0, 2000)
    };

  }


  if (!response.ok) {

    console.error(
      'PayPal create order error:',
      data
    );


    throw new Error(
      `PayPal order creation failed (${response.status}).`
    );

  }


  if (!data?.id) {

    throw new Error(
      'PayPal did not return an order ID.'
    );

  }


  return {

    id:
      data.id,

    provider:
      'paypal',

    currency:
      'USD',

    subtotal:
      Number(
        subtotal.toFixed(2)
      ),

    discount,

    total

  };

}


/*
 * PAYPAL - CAPTURE ORDER
 */

async function capturePayPalOrder(
  orderId,
  env
) {

  if (
    !orderId
  ) {

    throw new Error(
      'PayPal order ID is required.'
    );

  }


  const accessToken =
    await getPayPalAccessToken(
      env
    );


  const response =
    await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {

        method:
          'POST',

        headers: {

          'Authorization':
            `Bearer ${accessToken}`,

          'Content-Type':
            'application/json',

          'Accept':
            'application/json'

        }

      }
    );


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      raw:
        text.slice(0, 2000)
    };

  }


  if (!response.ok) {

    console.error(
      'PayPal capture error:',
      data
    );


    throw new Error(
      `PayPal capture failed (${response.status}).`
    );

  }


  return data;

}


export default {

  async fetch(
    request,
    env
  ) {

    const origin =
      request.headers.get('Origin') || '';


    try {

      /*
       * CORS
       */

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


      const url =
        new URL(
          request.url
        );


      /*
       * Simple health check
       */

      if (
        request.method === 'GET' &&
        url.pathname === '/'
      ) {

        return jsonResponse(
          {
            ok:
              true,

            service:
              'venus-checkout',

            status:
              'online'
          },

          200,

          origin
        );

      }


      /*
       * PayPal token endpoint
       *
       * This endpoint is not needed when using
       * Client ID authentication in SDK v6.
       * Kept out intentionally.
       */


      /*
       * PayPal create order
       */

      if (
        request.method === 'POST' &&
        url.pathname === '/paypal-create-order'
      ) {

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


        const body =
          await request.json();


        if (
          body?.country !== 'us'
        ) {

          return jsonResponse(
            {
              error:
                'PayPal endpoint requires country=us.'
            },

            400,

            origin
          );

        }


        const result =
          await createPayPalOrder(
            body,
            env
          );


        return jsonResponse(
          result,
          200,
          origin
        );

      }


      /*
       * PayPal capture order
       */

      if (
        request.method === 'POST' &&
        url.pathname === '/paypal-capture-order'
      ) {

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


        const body =
          await request.json();


        const result =
          await capturePayPalOrder(
            body?.orderId,
            env
          );


        return jsonResponse(
          {
            ok:
              true,

            provider:
              'paypal',

            order:
              result

          },

          200,

          origin
        );

      }


      /*
       * Brazil checkout
       */

      if (
        request.method === 'POST' &&
        url.pathname === '/'
      ) {

        if (
          !ALLOWED_ORIGINS.includes(origin)
        ) {

          return jsonResponse(
            {
              error:
                'Origin not allowed.',
              receivedOrigin:
                origin
            },

            403,

            origin
          );

        }


        const body =
          await request.json();


        if (
          body?.country === 'br'
        ) {

          const result =
            await createMercadoPagoCheckout(
              body,
              env
            );


          return jsonResponse(
            result,
            200,
            origin
          );

        }


        /*
         * We deliberately reject US requests
         * at this root route. US uses the dedicated
         * PayPal endpoints above.
         */

        return jsonResponse(
          {
            error:
              'For United States checkout, use the PayPal checkout flow.'
          },

          400,

          origin
        );

      }


      return jsonResponse(
        {
          error:
            'Not found.'
        },

        404,

        origin
      );


    } catch (error) {

      console.error(
        'Worker error:',
        error
      );


      return jsonResponse(
        {
          error:
            error?.message ||
            'Unexpected Worker error.'
        },

        500,

        origin
      );

    }

  }

};
