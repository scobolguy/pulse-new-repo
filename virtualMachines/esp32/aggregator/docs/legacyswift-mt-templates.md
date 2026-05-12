# LegacySwift MT Message Templates

This document captures mapper-ready field layouts for common SWIFT FIN MT messages.

The canonical config manifest is [data/legacyswift-mt-manifest.json](data/legacyswift-mt-manifest.json). Use it as the source of truth for families, message IDs, schema files, and map templates.

Layout and field metadata are owned by Data Librarian schemas under `data/schemas`. Map files should contain mapping rules only.

## Envelope
All three message types use the standard FIN envelope:

- Block 1: Basic Header
- Block 2: Application Header
- Block 3: User Header, optional
- Block 4: Text Block
- Block 5: Trailer

The business content is carried in Block 4.

## MT103+
MT103+ is the structured / STP-oriented profile of MT103.

### Common MT103+ fields
- `:20:` Sender's reference
- `:23B:` Bank operation code
- `:32A:` Value date, currency, amount
- `:33B:` Instructed amount
- `:50A/F/K:` Ordering customer
- `:59A/K:` Beneficiary customer
- `:70:` Remittance information
- `:71A:` Details of charges
- `:72:` Sender to receiver information

### Mapper-ready notes
- Treat MT103+ as a stricter MT103 variant.
- Keep the same source/target path shape as MT103 where the business meaning matches.
- Use MT103+ when the message requires STP formatting constraints.

### Example field groups
| FIN field | Meaning | Mapper target idea |
| --- | --- | --- |
| `:20:` | Sender reference | transactionId / messageId |
| `:23B:` | Operation code | transferType |
| `:32A:` | Value date, currency, amount | settlementDate / currency / amount |
| `:50:` | Ordering customer | debtor / originator |
| `:59:` | Beneficiary customer | creditor / beneficiary |
| `:70:` | Remittance information | remittanceText |
| `:71A:` | Charges | chargesBearer |
| `:72:` | Instruction / narrative | instructionText |

## MT202
MT202 is the classic bank-to-bank transfer message.

### Common MT202 fields
- `:20:` Sender's reference
- `:21:` Related reference
- `:32A:` Value date, currency, amount
- `:52A:` Ordering institution
- `:53A/B/D:` Sender's correspondent, optional
- `:54A/B/D:` Receiver's correspondent, optional
- `:56A/D:` Intermediary institution, optional
- `:57A/D:` Account with institution, optional
- `:58A:` Beneficiary institution
- `:72:` Sender to receiver information, optional

### Mapper-ready notes
- MT202 is a financial-institution transfer, not a customer transfer.
- It usually carries bank-to-bank routing and settlement data only.
- It does not carry the full originator/beneficiary customer details found in MT103.

### Example field groups
| FIN field | Meaning | Mapper target idea |
| --- | --- | --- |
| `:20:` | Sender reference | bankTransferId |
| `:21:` | Related reference | linkedPaymentId |
| `:32A:` | Value date, currency, amount | settlementDate / currency / amount |
| `:52A:` | Ordering institution | orderingBankBic |
| `:53A:` | Sender correspondent | senderCorrespondentBic |
| `:54A:` | Receiver correspondent | receiverCorrespondentBic |
| `:56A:` | Intermediary institution | intermediaryBic |
| `:57A:` | Account with institution | accountWithInstitutionBic |
| `:58A:` | Beneficiary institution | beneficiaryBankBic |
| `:72:` | Free narrative | instructionText |

## MT202 COV
MT202 COV is the cover-payment form of MT202.

### Common MT202 COV structure
MT202 COV is typically treated as two logical sequences:

- Sequence A: bank-to-bank cover leg
- Sequence B: originator / beneficiary detail leg

### Sequence A fields
- `:20:` Sender's reference
- `:21:` Related reference
- `:32A:` Value date, currency, amount
- `:52A:` Ordering institution
- `:53A/B/D:` Sender's correspondent, optional
- `:54A/B/D:` Receiver's correspondent, optional
- `:56A/D:` Intermediary institution, optional
- `:57A/D:` Account with institution, optional
- `:58A:` Beneficiary institution

### Sequence B fields
- `:50a:` Ordering customer
- `:59a:` Beneficiary customer
- `:72:` Sender to receiver information, optional

### Mapper-ready notes
- MT202 COV exists to preserve traceability for cover payments.
- Sequence B is the key difference from MT202: it carries originator and beneficiary customer data.
- Use it when intermediary banks need visibility into the ultimate parties.

### Example field groups
| FIN field | Meaning | Mapper target idea |
| --- | --- | --- |
| `:20:` | Sender reference | coverTransferId |
| `:21:` | Related reference | linkedCustomerTransferId |
| `:32A:` | Value date, currency, amount | settlementDate / currency / amount |
| `:52A:` | Ordering institution | orderingBankBic |
| `:50:` | Ordering customer | originator |
| `:59:` | Beneficiary customer | beneficiary |
| `:58A:` | Beneficiary institution | beneficiaryBankBic |
| `:72:` | Narrative / instruction | coverInstructionText |

## Suggested Mapping Conventions
For all three templates, keep target names consistent:

- `messageId` or `transactionId` for `:20:`
- `relatedReference` for `:21:`
- `settlementDate`, `currency`, `amount` for `:32A:`
- `orderingParty` or `originator` for `:50:`
- `beneficiaryParty` or `beneficiary` for `:59:`
- `bankBic` suffixes for institution identifiers
- `remittanceText` / `instructionText` for narrative fields

## Practical Use in Mapper
- Start with one-to-one field mappings for references, parties, and settlement data.
- Keep MT202 and MT202 COV separate because the latter includes customer detail.
- Use MT103+ as the customer-payment template when you want MT103 behavior with a stricter STP profile.

## Summary
- MT103+ = structured customer payment
- MT202 = bank-to-bank transfer
- MT202 COV = bank-to-bank cover transfer with originator and beneficiary detail

