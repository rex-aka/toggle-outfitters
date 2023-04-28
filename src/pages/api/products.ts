import product from '@/config/products';
import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getServerClient } from '../../utils/ld-server';
import { getCookie } from 'cookies-next';

/************************************************************************************************

  This file uses the `billing` feature flag in LaunchDarkly switch between an inventory file thats
  local or dynamically pull the product inventory directly from the Stripe product api
  
  User context is rendered from the 'ldcontext' cookie which gets set during login. It is decoded
  into a JSON object below

  *************************************************************************************************
  */


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: '2022-11-15', // or whichever version you're using
});

async function listAllProducts() {
  const products: Stripe.Product[] = [];

  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const result = await stripe.products.list({
      limit: 100, // increase limit to fetch more products per page
      starting_after: startingAfter, // use startingAfter to fetch the next page of products
    });

    products.push(...result.data);
    hasMore = result.has_more;

    if (hasMore) {
      startingAfter = result.data[result.data.length - 1].id;
    }
  }

  return products;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {

    const ldClient = await getServerClient(process.env.LD_SDK_KEY || "");
    const clientContext: any = getCookie('ldcontext', { req, res })

    const json = decodeURIComponent(clientContext);
    const jsonObject = JSON.parse(json);

    const billing = await ldClient.variation("billing", jsonObject, false);

    if (billing) {
      const products = await listAllProducts();
      console.log(products)
      return res.json(products);
    } else {
      return res.json(product)
    }
  }
}