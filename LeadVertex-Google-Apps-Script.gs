/**
 * Kohinoor Advance Plus -> LeadVertex CRM + WhatsApp click log.
 * Deploy as Google Apps Script Web App: Execute as Me; access Anyone.
 * Store credentials in Script Properties (never in GitHub):
 * LEADVERTEX_PROJECT=kohinoorplus
 * LEADVERTEX_WEBMASTER_ID=28
 * LEADVERTEX_TOKEN=YOUR_NEW_TOKEN
 * LEADVERTEX_GOOD_ID=184285
 * LEADVERTEX_PRODUCT_PRICE=2690
 * Optional: WHATSAPP_TRACKING_SHEET_ID=your Google Sheet ID
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
      + '?webmasterID=' + encodeURIComponent(webmasterId) + '&token=' + encodeURIComponent(token);
    var fields = {
      fio: name, phone: '+91' + phone, address: address, index: pincode,
      'goods[0][goodID]': goodId, 'goods[0][quantity]': '1', 'goods[0][price]': price,
      comment: 'Landing page order; Kohinoor Advance Plus; WhatsApp ref: ' + String(p.whatsapp_ref || '') + '; ExoClick ID: ' + String(p.exo_click_id || ''),
      utm_source: p.utm_source || '', utm_medium: p.utm_medium || '',
      utm_campaign: p.utm_campaign || '', utm_content: p.utm_content || '', utm_term: p.utm_term || '',
    };
    var encoded = Object.keys(fields).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(String(fields[k]));
    }).join('&');
    var response = UrlFetchApp.fetch(endpoint, {
      method:'post', contentType:'application/x-www-form-urlencoded', payload:encoded,
      muteHttpExceptions:true, followRedirects:true
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

// Browser sends a transparent image GET when a WhatsApp button is clicked.
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.action === 'wa_click') {
    try { logWhatsAppClick_(p); }
    catch (err) { console.error('WhatsApp click log error: ' + err); }
    return pixel_();
  }
  return json_({success:true, message:'Kohinoor tracking bridge is running.'});
}

function getTrackingSheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('WHATSAPP_TRACKING_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.create('Kohinoor WhatsApp Lead Tracking');
  var sh = ss.getSheets()[0];
  sh.setName('WhatsApp Clicks');
  sh.appendRow(['Timestamp','Event','Reference ID','ExoClick ID','Campaign ID','Site ID','Zone ID','Banner ID','UTM Source','UTM Medium','UTM Campaign','UTM Content','UTM Term','Landing Page','Message received?','Order/CRM ID','Order status','Order value']);
  sh.setFrozenRows(1);
  props.setProperty('WHATSAPP_TRACKING_SHEET_ID', ss.getId());
  props.setProperty('WHATSAPP_TRACKING_SHEET_URL', ss.getUrl());
  console.log('WHATSAPP_TRACKING_SHEET_URL=' + ss.getUrl());
  return ss;
}

function logWhatsAppClick_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getTrackingSheet_();
    var sh = ss.getSheetByName('WhatsApp Clicks') || ss.getSheets()[0];
    sh.appendRow([
      new Date(), 'WhatsApp button click', safe_(p.ref_id), safe_(p.click_id),
      safe_(p.campaign_id), safe_(p.site_id), safe_(p.zone_id), safe_(p.banner_id),
      safe_(p.utm_source), safe_(p.utm_medium), safe_(p.utm_campaign),
      safe_(p.utm_content), safe_(p.utm_term), safe_(p.page_url),
      'Not verified', '', 'Not updated', ''
    ]);
  } finally { lock.releaseLock(); }
}

function safe_(v) { return String(v || '').slice(0, 500); }
function pixel_() {
  var bytes = Utilities.base64Decode('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=');
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.GIF);
}
function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Run this function once in the Apps Script editor to print the tracking sheet URL.
function showTrackingSheetUrl() {
  var ss = getTrackingSheet_();
  console.log(ss.getUrl());
}
