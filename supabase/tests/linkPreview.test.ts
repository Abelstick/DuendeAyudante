import { describe, expect, it } from 'vitest';
import { decodeEntities, isSafePublicUrl, parseLinkMetadata, parsePrice, titleFromUrl } from '../functions/link-preview/parse';

describe('vista previa de enlaces: nombre desde el enlace (respaldo)', () => {
  it.each([
    [
      'https://www.lacuracao.pe/pad-mouse-razer-gigantus-v2-softm-black-efegc03132.html?utm_term=&hsa_grp=',
      'Pad mouse razer gigantus v2 softm black',
    ],
    ['https://www.amazon.com/Razer-Gigantus-V2-Medium-Mouse/dp/B08BZQ1GHG/ref=sr_1_1', 'Razer gigantus v2 medium mouse'],
    ['https://www.falabella.com.pe/falabella-pe/product/17069001/Audifonos-Inalambricos-Sony-WH-CH520/17069002', 'Audifonos inalambricos sony wh ch520'],
    ['https://tienda.pe/p/123456', null],
    ['https://tienda.pe/', null],
  ])('%s → %s', (url, expected) => {
    expect(titleFromUrl(url)).toBe(expected);
  });
});

describe('vista previa de enlaces: precio', () => {
  it.each([
    ['S/ 59.90', 59.9],
    ['1,299.90', 1299.9],
    ['1.299,90', 1299.9],
    ['59,9', 59.9],
    ['1,299', 1299],
    ['2.500', 2500],
    [149, 149],
    ['gratis', null],
    ['0', null],
  ])('%s → %s', (raw, expected) => {
    expect(parsePrice(raw)).toBe(expected);
  });
});

describe('vista previa de enlaces: datos de la página', () => {
  it('prefiere el producto de JSON-LD (nombre, precio, moneda y foto)', () => {
    const html = `
      <html><head>
        <title>Polo Azul | Tienda.pe</title>
        <meta property="og:title" content="Otro título">
        <meta property="og:site_name" content="Tienda">
        <script type="application/ld+json">
          {"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"Polo Azul Talla M","image":["/img/polo.jpg"],
           "offers":{"@type":"Offer","price":"79.90","priceCurrency":"PEN"}}]}
        </script>
      </head></html>`;
    expect(parseLinkMetadata(html, 'https://tienda.pe/p/1')).toEqual({
      title: 'Polo Azul Talla M',
      price: 79.9,
      currency: 'PEN',
      image: 'https://tienda.pe/img/polo.jpg',
      siteName: 'Tienda',
    });
  });

  it('usa Open Graph y quita el nombre de la tienda del título', () => {
    const html = `<meta content="Audífonos Bluetooth &amp; Estuche - Tienda.com" property="og:title" />
      <meta property="product:price:amount" content="1.299,00"><meta property="product:price:currency" content="pen">
      <meta property='og:image' content='https://cdn.tienda.com/a.png'>`;
    expect(parseLinkMetadata(html, 'https://tienda.com/x')).toMatchObject({
      title: 'Audífonos Bluetooth & Estuche',
      price: 1299,
      currency: 'PEN',
      image: 'https://cdn.tienda.com/a.png',
    });
  });

  it('lee tiendas Magento como La Curacao (sin og:title, precio en product:price y JSON-LD)', () => {
    const html = `<title>Mouse Pad Gamer Razer Gigantus V2 Soft Medium Black</title>
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content="69"/>
      <meta itemprop="priceCurrency" content="PEN" />
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Mouse Pad Gamer Razer Gigantus V2 Soft Medium Black",
        "image":"https://www.lacuracao.pe/media/catalog/product/e/f/efegc03132_1.jpg","brand":{"@type":"Brand","name":"RAZER"},
        "offers":{"@type":"Offer","price":69,"priceCurrency":"PEN"}}</script>`;
    expect(parseLinkMetadata(html, 'https://www.lacuracao.pe/x.html')).toEqual({
      title: 'Mouse Pad Gamer Razer Gigantus V2 Soft Medium Black',
      price: 69,
      currency: 'PEN',
      image: 'https://www.lacuracao.pe/media/catalog/product/e/f/efegc03132_1.jpg',
      siteName: null,
    });
  });

  it('sin datos de producto, al menos el título de la página', () => {
    expect(parseLinkMetadata('<title> Mi página </title>', 'https://x.com')).toEqual({ title: 'Mi página', price: null, currency: null, image: null, siteName: null });
  });

  it('decodifica entidades', () => {
    expect(decodeEntities('Ni&ntilde;o &#233; &#x41; &quot;')).toBe('Ni&ntilde;o é A "');
  });
});

describe('vista previa de enlaces: seguridad', () => {
  it.each([
    ['https://www.falabella.com.pe/producto/1', true],
    ['http://tienda.pe', true],
    ['ftp://tienda.pe', false],
    ['http://localhost:3000', false],
    ['http://127.0.0.1', false],
    ['http://10.0.0.5', false],
    ['http://192.168.1.1', false],
    ['http://169.254.169.254/latest/meta-data', false],
    ['http://[::1]/', false],
    ['http://intranet/', false],
    ['https://user:pass@tienda.pe', false],
    ['https://tienda.pe:8080', false],
    ['http://8.8.8.8', true],
  ])('%s → %s', (url, ok) => {
    expect(isSafePublicUrl(url)).toBe(ok);
  });
});
