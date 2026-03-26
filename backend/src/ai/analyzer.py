import json
from openai import OpenAI
from src.config.settings import get_settings

settings = get_settings()
client   = OpenAI(api_key=settings.OPENAI_API_KEY)


SYSTEM_PROMPT = """
You are an expert B2B sales analyst for BluQQ, an AI services company.
Your job is to analyze inbound leads and provide structured intelligence.

BluQQ offers: AI automation, chatbot development, workflow automation,
custom software, CRM integration, data analytics, web/mobile development.

You must respond with ONLY valid JSON — no explanation, no markdown, no extra text.
"""


def build_prompt(lead: dict) -> str:
    return f"""
Analyze this inbound lead and return a JSON object:

Lead Information:
- Name: {lead.get('name', 'Unknown')}
- Company: {lead.get('company', 'Not provided')}
- Email: {lead.get('email', 'Not provided')}
- Phone: {lead.get('phone', 'Not provided')}
- Source: {lead.get('source', 'Unknown')}
- Service Interest: {lead.get('service_interest', 'Not specified')}
- Message: {lead.get('message', 'No message')}

Return ONLY this JSON structure with no extra text:
{{
  "summary": "2-3 sentence summary of who this lead is and what they want",
  "intent": "one of: purchase, explore, comparison, unclear",
  "urgency": "one of: high, medium, low",
  "qualification_label": "one of: Qualified, Potential, Weak, Spam",
  "recommended_action": "specific next action the sales team should take",
  "confidence": 0.0
}}

Rules for qualification_label:
- Qualified: Clear need, budget signals, business email, specific request
- Potential: Some interest but missing details, needs nurturing
- Weak: Vague request, no company, free email, low intent signals
- Spam: Irrelevant, gibberish, or clearly not a real lead

Rules for confidence (0.0 to 1.0):
- Higher if lead has company, email, phone, specific service interest
- Lower if lead has missing fields or vague message
"""


def analyze_lead_with_ai(lead: dict) -> dict:
    """
    Send lead to GPT-4 and return structured analysis.
    Returns a fallback dict if anything fails.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Fast + cheap, great for this use case
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": build_prompt(lead)}
            ],
            temperature=0.3,      # Low temp = consistent structured output
            max_tokens=500,
            response_format={"type": "json_object"}  # Forces JSON output
        )

        raw = response.choices[0].message.content
        result = json.loads(raw)

        # Validate all required fields exist
        return {
            "summary":              result.get("summary", "No summary available"),
            "intent":               result.get("intent", "unclear"),
            "urgency":              result.get("urgency", "low"),
            "qualification_label":  result.get("qualification_label", "Potential"),
            "recommended_action":   result.get("recommended_action", "Follow up with the lead"),
            "confidence":           float(result.get("confidence", 0.5)),
            "raw_ai_response":      result
        }

    except Exception as e:
        # Never crash the lead creation — return safe fallback
        print(f"[AI Analyzer] Error analyzing lead: {e}")
        return {
            "summary":             "AI analysis failed — please retry manually",
            "intent":              "unclear",
            "urgency":             "low",
            "qualification_label": "Potential",
            "recommended_action":  "Review lead manually and follow up",
            "confidence":          0.0,
            "raw_ai_response":     {"error": str(e)}
        }