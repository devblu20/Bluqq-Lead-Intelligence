import csv
import io
from typing import List, Dict, Tuple

# Required columns that MUST exist in the CSV
REQUIRED_COLUMNS = {"name", "message"}

# All valid columns we accept
VALID_COLUMNS = {
    "name", "company", "email", "phone",
    "source", "service_interest", "message"
}

# Valid source values
VALID_SOURCES = {
    "LinkedIn", "Website", "Email", "Upwork", "Manual"
}


def parse_csv_leads(
    file_content: bytes
) -> Tuple[List[Dict], List[Dict]]:
    """
    Parse CSV file content into a list of lead dicts.

    Returns:
        valid_leads   — list of clean lead dicts ready to insert
        errors        — list of {row, reason} for skipped rows
    """
    valid_leads = []
    errors      = []

    try:
        # Decode bytes to string
        content = file_content.decode("utf-8-sig")  # utf-8-sig handles BOM
        reader  = csv.DictReader(io.StringIO(content))

        # Check required columns exist
        if not reader.fieldnames:
            return [], [{"row": 0, "reason": "CSV file is empty or has no headers"}]

        # Normalize column names (strip spaces, lowercase for checking)
        columns = {col.strip().lower() for col in reader.fieldnames}

        missing = REQUIRED_COLUMNS - columns
        if missing:
            return [], [{
                "row": 0,
                "reason": f"Missing required columns: {', '.join(missing)}"
            }]

        # Process each row
        for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 is header

            # Clean all values (strip whitespace)
            cleaned = {
                k.strip().lower(): v.strip()
                for k, v in row.items()
                if k  # skip None keys
            }

            # Validate required fields
            name    = cleaned.get("name", "")
            message = cleaned.get("message", "")

            if not name:
                errors.append({
                    "row":    row_num,
                    "reason": "Missing required field: name"
                })
                continue

            if not message:
                errors.append({
                    "row":    row_num,
                    "reason": "Missing required field: message"
                })
                continue

            # Validate and normalize source
            source = cleaned.get("source", "Manual").strip()
            if source not in VALID_SOURCES:
                # Try to match case-insensitively
                matched = next(
                    (s for s in VALID_SOURCES
                     if s.lower() == source.lower()),
                    "Manual"
                )
                source = matched

            # Build clean lead dict
            lead = {
                "name":             name,
                "company":          cleaned.get("company") or None,
                "email":            cleaned.get("email")   or None,
                "phone":            cleaned.get("phone")   or None,
                "source":           source,
                "service_interest": cleaned.get("service_interest") or None,
                "message":          message,
            }

            valid_leads.append(lead)

    except UnicodeDecodeError:
        return [], [{
            "row":    0,
            "reason": "File encoding error. Please save your CSV as UTF-8."
        }]
    except Exception as e:
        return [], [{
            "row":    0,
            "reason": f"Failed to parse CSV: {str(e)}"
        }]

    return valid_leads, errors