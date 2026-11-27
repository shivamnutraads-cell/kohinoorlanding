/**
 * Kohinoor Advance Plus -> LeadVertex CRM bridge.
 * Deploy as a Google Apps Script Web App:
 * Execute as: Me | Who has access: Anyone
 *
 * Store credentials in Project Settings -> Script Properties:
 * LEADVERTEX_PROJECT=kohinoorplus
 * LEADVERTEX_WEBMASTER_ID=28
 * LEADVERTEX_TOKEN=YOUR_NEW_LEADVERTEX_API_TOKEN
 * LEADVERTEX_GOOD_ID=184285
 * LEADVERTEX_PRODUCT_PRICE=2690
 */
function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var name = String(p.name || '').trim();
    var phone = String(p.mobile || '').replace(/\D/g, '');
    var address = String(p.address || '').trim();
    var pincode = String(p.pincode || '').replace(/\D/g, '');

    if (!name || !/^[6-9]\d{9}$/.test(phone) || !address || !/^[1-9]\d{5}$/.test(pincode)) {
      return json_({success:false, error:'कृपया नाम, सही 10 अंकों का मोबाइल नंबर, पूरा पता और 6 अंकों का पिन कोड भरें।'});
    }

    var props = PropertiesService.getScriptProperties();
    var project = props.getProperty('LEADVERTEX_PROJECT');
    var webmasterId = props.getProperty('LEADVERTEX_WEBMASTER_ID');
    var token = props.getProperty('LEADVERTEX_TOKEN');
    var goodId = props.getProperty('LEADVERTEX_GOOD_ID');
    var price = props.getProperty('LEADVERTEX_PRODUCT_PRICE');

    if (!project || !webmasterId || !token || !goodId || !price) {
      return json_({success:false, error:'LeadVertex setup अधूरा है। Admin Script Properties जाँचें।'});
    }

    var endpoint = 'https://' + project + '.leadvertex.ru/api/webmaster/v2/addOrder.html'
      + '?webmasterID=' + encodeURIComponent(webmasterId)
      + '&token=' + encodeURIComponent(token);

    // Match the PHP integration's nested goods[0] form fields.
    var fields = {
      fio: name,
      phone: '+91' + phone,
      address: address,
      index: pincode,
      'goods[0][goodID]': goodId,
      'goods[0][quantity]': '1',
      'goods[0][price]': price,
      comment: 'Landing page order; Kohinoor Advance Plus',
      utm_source: p.utm_source || '',
      utm_medium: p.utm_medium || '',
      utm_campaign: p.utm_campaign || '',
      utm_content: p.utm_content || '',
      utm_term: p.utm_term || ''
    };
    var encoded = Object.keys(fields).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(String(fields[k]));
    }).join('&');

    var response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: encoded,
      muteHttpExceptions: true,
      followRedirects: true
    });

    var status = response.getResponseCode();
    var body = response.getContentText();
    if (status < 200 || status >= 300) {
      console.error('LeadVertex HTTP ' + status + ': ' + body.slice(0, 1000));
      return json_({success:false, error:'CRM से संपर्क नहीं हो पाया। कृपया कुछ देर बाद फिर कोशिश करें।'});
    }

    var parsed = null;
    try { parsed = JSON.parse(body); } catch (ignore) {}
    if (parsed && (parsed.error || parsed.success === false)) {
      console.error('LeadVertex rejected order: ' + body.slice(0, 1000));
      return json_({success:false, error:'LeadVertex ने ऑर्डर स्वीकार नहीं किया। कृपया विवरण जाँचें।'});
    }

    return json_({success:true, message:'Order accepted by LeadVertex'});
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({success:false, error:'Order process नहीं हो पाया। कृपया दोबारा कोशिश करें।'});
  }
}

function doGet() {
  return json_({success:true, message:'Kohinoor LeadVertex bridge is running. Submit orders using POST.'});
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
