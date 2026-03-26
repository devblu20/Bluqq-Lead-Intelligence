from fastapi import HTTPException
import httpx

WHATSAPP_API_URL = "https://graph.facebook.com/v18.0"


def clean_phone(phone: str) -> str:
    """
    Clean phone number — remove everything except digits.
    +91 98765 43210  →  919876543210
    91-9876543210    →  919876543210
    09876543210      →  919876543210
    9876543210       →  919876543210
    """
    cleaned = ''.join(filter(str.isdigit, phone))
    if cleaned.startswith('0'):
        cleaned = '91' + cleaned[1:]
    if len(cleaned) == 10:
        cleaned = '91' + cleaned
    print(f"[WHATSAPP DEBUG] original phone : {phone}")
    print(f"[WHATSAPP DEBUG] cleaned phone  : {cleaned}")
    print(f"[WHATSAPP DEBUG] phone length   : {len(cleaned)}")
    return cleaned


async def send_whatsapp_message(
    phone_number_id: str,
    access_token: str,
    to_phone: str,
    message: str
) -> dict:
    to_phone = clean_phone(to_phone)
    url      = f"{WHATSAPP_API_URL}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type":    "individual",
        "to":                to_phone,
        "type":              "text",
        "text":              {"body": message}
    }
    print(f"[WHATSAPP DEBUG] sending to     : {to_phone}")
    print(f"[WHATSAPP DEBUG] phone_number_id: {phone_number_id}")
    print(f"[WHATSAPP DEBUG] message preview: {message[:60]}")
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type":  "application/json"
            }
        )
        print(f"[META STATUS]    {resp.status_code}")
        print(f"[META RESPONSE]  {resp.text}")
        if resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Meta API error {resp.status_code}: {resp.text}"
            )
        return resp.json()


async def send_whatsapp_template(
    phone_number_id: str,
    access_token: str,
    to_phone: str,
    # ✅ CHANGED: updated default template name to your approved template
    template_name: str = "bluqq_first_outreach",
    language_code: str = "en_US"
) -> dict:
    to_phone = clean_phone(to_phone)
    url      = f"{WHATSAPP_API_URL}/{phone_number_id}/messages"

    # ✅ No components needed — plain fixed text template has no variables
    payload = {
        "messaging_product": "whatsapp",
        "to":       to_phone,
        "type":     "template",
        "template": {
            "name":     template_name,
            "language": {"code": language_code}
        }
    }

    print(f"[WHATSAPP TEMPLATE] sending to      : {to_phone}")
    print(f"[WHATSAPP TEMPLATE] phone_number_id : {phone_number_id}")
    print(f"[WHATSAPP TEMPLATE] template        : {template_name}")
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type":  "application/json"
            }
        )
        print(f"[META STATUS]    {resp.status_code}")
        print(f"[META RESPONSE]  {resp.text}")
        if resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Meta API error {resp.status_code}: {resp.text}"
            )
        return resp.json()