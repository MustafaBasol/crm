# Numbering & Public Link IDs — Quotes

## Quote Numbering
- Pattern per company/country: e.g., `Q-{YYYY}-{MM}-{####}`
- Tokens:
  - {YYYY}, {YY}
  - {MM}
  - {####} (zero-padded sequence)
  - {COUNTRY} (optional)
- Sequence resets: per pattern scope (with month in pattern, sequence resets monthly)
- Uniqueness: per tenant, per pattern

Notes:
- Backward compatibility: existing quotes keep their stored `quoteNumber`.
- New quotes use the current pattern.

## Versioning & Display
- Versions indicated as v1, v2…
- Display examples:
  - Q-2025-12-0042 (v1)
  - Q-2025-12-0042 (v2)

## Public Link
- Tokenized unguessable ID separate from internal numbers
- Expiration optional (configurable); regeneration invalidates previous links
