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


    try {

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


      if (
        !env.MERCADOPAGO_ACCESS_TOKEN
      ) {

        return jsonResponse(
          {
            error:
              'MERCADOPAGO_ACCESS_TOKEN is missing.'
          },

          500,

          origin
        );

      }


      const body =
        await request.json();


      if (
        !body ||
        !Array.isArray(body.items) ||
        body.items.length === 0
      ) {

        return jsonResponse(
          {
            error:
              'Cart is empty or invalid.'
          },

          400,

          origin
        );

      }


      if (
        body.country !== 'br'
      ) {

        return jsonResponse(
          {
            error:
              'Only Brazil checkout is enabled in this version.'
          },

          400,

          origin
        );

      }


      const items = [];


      for (
        const incoming of body.items
      ) {

        const id =
          String(
            incoming?.id || ''
          );


        const catalogItem =
          CATALOG[id];


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
          Math.max(
            1,
            Math.min(
              10,
              Number(
                incoming?.quantity || 1
              )
            )
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


      const subtotal =
        items.reduce(
          (
            sum,
            item
          ) =>
            sum +
            (
              item.unit_price *
              item.quantity
            ),

          0
        );


      const requestedDiscount =
        Number(
          body.discount || 0
        );


      const validDiscount =
        Object.values(
          COUPONS
        ).includes(
          requestedDiscount
        )
          ? requestedDiscount
          : 0;


      const mercadoPagoItems =
        items.map(
          item => {

            const discountedPrice =
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
                discountedPrice,

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


      if (email) {

        preference.payer = {
          email
        };

      }


      let mpResponse;


      try {

        mpResponse =
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
              'Mercado Pago connection failed.',

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


      const responseText =
        await mpResponse.text();


      let mpData;


      try {

        mpData =
          JSON.parse(
            responseText
          );

      } catch {

        mpData = {
          raw:
            responseText.slice(
              0,
              2000
            )
        };

      }


      if (
        !mpResponse.ok
      ) {

        return jsonResponse(
          {
            error:
              'Mercado Pago rejected the preference.',

            status:
              mpResponse.status,

            details:
              mpData
          },

          502,

          origin
        );

      }


      const checkoutUrl =
        mpData?.init_point ||
        mpData?.sandbox_init_point;


      if (!checkoutUrl) {

        return jsonResponse(
          {
            error:
              'Mercado Pago created no checkout URL.',

            details:
              mpData
          },

          502,

          origin
        );

      }


      return jsonResponse(
        {
          ok:
            true,

          init_point:
            checkoutUrl,

          preference_id:
            mpData?.id ||
            null,

          subtotal:
            Number(
              subtotal.toFixed(2)
            ),

          discount:
            validDiscount,

          total:
            Number(
              (
                subtotal *
                (1 - validDiscount)
              ).toFixed(2)
            )
        },

        200,

        origin
      );


    } catch (error) {

      /*
       * FINAL SAFETY NET:
       * No unexpected exception should
       * turn into an HTML response.
       */

      return jsonResponse(
        {
          error:
            'Worker exception.',

          details:
            String(
              error?.message ||
              error
            )
        },

        500,

        origin
      );

    }

  }

};
