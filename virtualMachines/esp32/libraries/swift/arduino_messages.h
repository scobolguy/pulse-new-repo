#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>

namespace pulse::swift::arduino {
inline String trimCopy(String value) { value.trim(); return value; }
inline String toUpperCopy(String value) { value.toUpperCase(); return value; }
inline String toLowerCopy(String value) { value.toLowerCase(); return value; }

inline String normalizeMtAmount(const String& raw) {
    String s = trimCopy(raw);
    s.replace(" ", "");
    s.replace(",", ".");
    return s;
}

inline String normalizeChargeBearer(const String& raw) {
    String s = toUpperCopy(trimCopy(raw));
    if (s == "OUR" || s == "SHA" || s == "BEN") return s;
    return trimCopy(raw);
}

inline String yymmddToIsoDate(const String& raw) {
    String s = trimCopy(raw);
    if (s.length() != 6) return s;
    String yy = s.substring(0, 2);
    String mm = s.substring(2, 4);
    String dd = s.substring(4, 6);
    int year = 2000 + yy.toInt();
    if (mm.toInt() < 1 || mm.toInt() > 12 || dd.toInt() < 1 || dd.toInt() > 31) {
        return s;
    }
    char out[11];
    snprintf(out, sizeof(out), "%04d-%02d-%02d", year, mm.toInt(), dd.toInt());
    return String(out);
}

inline String mtPartyName(const String& raw) {
    String s = trimCopy(raw);
    int nl = s.indexOf('\n');
    if (nl < 0) return s;
    String first = trimCopy(s.substring(0, nl));
    if (first.startsWith("/")) {
        return trimCopy(s.substring(nl + 1));
    }
    return s;
}

inline void parseMt103FinText(const String& text, JsonDocument& outDoc) {
    outDoc.clear();
    JsonObject root = outDoc.to<JsonObject>();
    JsonObject block4 = root["block4"].to<JsonObject>();

    String currentTag;
    String currentValue;
    auto commitTag = [&](const String& tag, const String& value) {
        if (tag.length() == 0) return;
        if (tag == "32A") {
            JsonObject field32A = block4["32A"].to<JsonObject>();
            String v = trimCopy(value);
            if (v.length() >= 9) {
                field32A["date"] = v.substring(0, 6);
                field32A["currency"] = v.substring(6, 9);
                field32A["amount"] = v.substring(9);
            } else {
                field32A["raw"] = v;
            }
            return;
        }
        if (tag == "33B") {
            JsonObject field33B = block4["33B"].to<JsonObject>();
            String v = trimCopy(value);
            if (v.length() >= 3) {
                field33B["currency"] = v.substring(0, 3);
                field33B["amount"] = v.substring(3);
            } else {
                field33B["raw"] = v;
            }
            return;
        }
        block4[tag] = trimCopy(value);
    };

    int start = 0;
    while (start <= (int)text.length()) {
        int nl = text.indexOf('\n', start);
        String line = (nl >= 0) ? text.substring(start, nl) : text.substring(start);
        line.replace("\r", "");

        if (line.startsWith(":")) {
            int secondColon = line.indexOf(':', 1);
            if (secondColon > 1) {
                commitTag(currentTag, currentValue);
                currentTag = line.substring(1, secondColon);
                currentValue = line.substring(secondColon + 1);
            } else if (currentTag.length() > 0) {
                currentValue += "\n" + line;
            }
        } else if (currentTag.length() > 0) {
            currentValue += "\n" + line;
        }

        if (nl < 0) break;
        start = nl + 1;
    }
    commitTag(currentTag, currentValue);
}

inline String normalizeIngressMessage(const String& message) {
    String normalized = message;
    normalized.replace("\r\n", "\n");
    normalized.replace("\r", "\n");
    normalized.trim();
    return normalized;
}

inline String detectIngressMessageType(const String& normalizedMessage) {
    String upper = toUpperCopy(normalizedMessage);
    if (upper.startsWith("MT202") || upper.indexOf(":21:") >= 0) {
        return "MT202";
    }
    if (upper.startsWith("MT103") || upper.indexOf("\n:20:") >= 0 || upper.indexOf(":23B:") >= 0) {
        return "MT103";
    }
    if (upper.indexOf("<DOCUMENT") >= 0 && upper.indexOf("PACS") >= 0) {
        if (upper.indexOf("PACS.008") >= 0 || upper.indexOf("PACS008") >= 0) return "PACS008";
        if (upper.indexOf("PACS.009") >= 0 || upper.indexOf("PACS009") >= 0) return "PACS009";
        return "PACS";
    }
    if (normalizedMessage.startsWith("{") || normalizedMessage.startsWith("[")) {
        return "JSON";
    }
    return "UNKNOWN";
}

inline String xmlEscapeText(const String& value) {
    String out = value;
    out.replace("&", "&amp;");
    out.replace("<", "&lt;");
    out.replace(">", "&gt;");
    out.replace("\"", "&quot;");
    out.replace("'", "&apos;");
    return out;
}

inline void appendIndent(String& out, int indent) {
    for (int i = 0; i < indent; i += 1) out += ' ';
}

inline void appendXmlNode(String& out, const String& name, JsonVariantConst value, int indent) {
    appendIndent(out, indent);

    if (value.isNull()) {
        out += "<" + name + "></" + name + ">\n";
        return;
    }

    if (value.is<const char*>()) {
        out += "<" + name + ">" + xmlEscapeText(String(value.as<const char*>())) + "</" + name + ">\n";
        return;
    }
    if (value.is<String>()) {
        out += "<" + name + ">" + xmlEscapeText(value.as<String>()) + "</" + name + ">\n";
        return;
    }
    if (value.is<long>() || value.is<unsigned long>() || value.is<float>() || value.is<double>() || value.is<bool>()) {
        out += "<" + name + ">" + xmlEscapeText(value.as<String>()) + "</" + name + ">\n";
        return;
    }

    if (value.is<JsonArrayConst>()) {
        JsonArrayConst arr = value.as<JsonArrayConst>();
        for (JsonVariantConst item : arr) {
            appendXmlNode(out, name, item, indent);
        }
        return;
    }

    if (!value.is<JsonObjectConst>()) {
        out += "<" + name + ">" + xmlEscapeText(value.as<String>()) + "</" + name + ">\n";
        return;
    }

    JsonObjectConst obj = value.as<JsonObjectConst>();
    std::vector<String> attrs;
    String textValue = "";
    int childCount = 0;

    for (JsonPairConst pair : obj) {
        String key = String(pair.key().c_str());
        if (key.startsWith("@")) {
            attrs.push_back(key.substring(1) + "=\"" + xmlEscapeText(pair.value().as<String>()) + "\"");
        } else if (key == "#text") {
            textValue = pair.value().as<String>();
        } else {
            childCount += 1;
        }
    }

    out += "<" + name;
    for (const auto& attr : attrs) {
        out += " " + attr;
    }

    if (childCount == 0) {
        out += ">" + xmlEscapeText(textValue) + "</" + name + ">\n";
        return;
    }

    out += ">\n";
    for (JsonPairConst pair : obj) {
        String key = String(pair.key().c_str());
        if (key.startsWith("@") || key == "#text") continue;
        appendXmlNode(out, key, pair.value(), indent + 2);
    }
    appendIndent(out, indent);
    out += "</" + name + ">\n";
}

inline String jsonObjectToXmlDocument(JsonObjectConst rootObj) {
    String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    for (JsonPairConst pair : rootObj) {
        appendXmlNode(xml, String(pair.key().c_str()), pair.value(), 0);
    }
    return xml;
}

inline bool inferIsoTypeId(const String& dataTypeId) {
    const String normalized = toLowerCopy(trimCopy(dataTypeId));
    if (normalized.isEmpty()) return false;

    static const char* kIsoPrefixes[] = {
        "pacs", "camt", "pain", "head", "remt",
        "acmt", "admi", "auth", "caaa", "caam",
        "cain", "catm", "catp", "reda", "secl",
        "seev", "semt", "tsin"
    };

    for (const char* prefix : kIsoPrefixes) {
        const String p = String(prefix);
        if (normalized == p || normalized.startsWith(p + ".") || normalized.startsWith(p + "-")) {
            return true;
        }
    }

    return false;
}

inline String resolveIsoXmlNamespace(const String& dataTypeId, JsonObjectConst document) {
    const String normalized = toLowerCopy(trimCopy(dataTypeId));
    if (normalized == "pacs" || normalized.startsWith("pacs")) {
        if (document["FIToFICdtTrf"].is<JsonObject>()) {
            return "urn:iso:std:iso:20022:tech:xsd:pacs.009.001.10";
        }
        return "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10";
    }
    if (normalized == "camt" || normalized.startsWith("camt")) {
        if (document["BkToCstmrAcctRpt"].is<JsonObject>()) {
            return "urn:iso:std:iso:20022:tech:xsd:camt.052.001.14";
        }
        if (document["BkToCstmrDbtCdtNtfctn"].is<JsonObject>()) {
            return "urn:iso:std:iso:20022:tech:xsd:camt.054.001.14";
        }
        return "urn:iso:std:iso:20022:tech:xsd:camt.053.001.14";
    }
    return "";
}

inline void ensureIsoNamespaces(const String& dataTypeId, JsonObject document) {
    const String normalized = toLowerCopy(trimCopy(dataTypeId));
    const String ns = resolveIsoXmlNamespace(normalized, document);
    if (ns.length() > 0 && !document["@xmlns"].is<const char*>()) {
        document["@xmlns"] = ns;
    }
    if (!document["@xmlns:xsi"].is<const char*>()) {
        document["@xmlns:xsi"] = "http://www.w3.org/2001/XMLSchema-instance";
    }

    if (normalized == "pacs" || normalized.startsWith("pacs")) {
        if (!document["@xmlns:hdr"].is<const char*>()) {
            document["@xmlns:hdr"] = "urn:swift:xsd:head.001.001.02";
        }

        String msgId = "";
        if (document["FIToFICstmrCdtTrf"].is<JsonObject>()) {
            JsonObject tx = document["FIToFICstmrCdtTrf"].as<JsonObject>();
            if (tx["GrpHdr"].is<JsonObject>()) {
                JsonObject grp = tx["GrpHdr"].as<JsonObject>();
                if (grp["MsgId"].is<const char*>()) {
                    msgId = String(grp["MsgId"].as<const char*>());
                }
            }
        }

        if (msgId.length() > 0 && !document["hdr:AppHdr"].is<JsonObject>()) {
            JsonObject appHdr = document["hdr:AppHdr"].to<JsonObject>();
            appHdr["hdr:BizMsgIdr"] = msgId;
        }
    }
}

inline String extractMtFieldLine(const String& message, const String& fieldTag) {
    int idx = message.indexOf(fieldTag);
    if (idx < 0) return "";
    int start = idx + fieldTag.length();
    int end = message.indexOf('\n', start);
    if (end < 0) end = message.length();
    String value = message.substring(start, end);
    value.trim();
    return value;
}

inline String buildPacsXmlFromMt(const String& normalizedMessage, const String& messageType) {
    String txId = extractMtFieldLine(normalizedMessage, ":20:");
    if (txId.length() == 0) {
        txId = String("TX-") + String((unsigned long)millis());
    }

    String relRef = extractMtFieldLine(normalizedMessage, ":21:");
    if (relRef.length() == 0) relRef = txId;

    String amountField = extractMtFieldLine(normalizedMessage, ":32A:");
    String ccy = "USD";
    String amount = "0";
    if (amountField.length() >= 9) {
        ccy = amountField.substring(6, 9);
        amount = amountField.substring(9);
        ccy.trim();
        amount.trim();
    }
    amount.replace(',', '.');

    const bool isMt202 = (toUpperCopy(messageType) == "MT202");
    const String pacsNs = isMt202
        ? "urn:iso:std:iso:20022:tech:xsd:pacs.009.001.10"
        : "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10";

    String xml;
    xml.reserve(1200);
    xml += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    xml += "<Document xmlns=\"" + pacsNs + "\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:hdr=\"urn:swift:xsd:head.001.001.02\">\n";
    xml += "  <hdr:AppHdr>\n";
    xml += "    <hdr:BizMsgIdr>" + xmlEscapeText(txId) + "</hdr:BizMsgIdr>\n";
    xml += "  </hdr:AppHdr>\n";
    xml += "  <FIToFICstmrCdtTrf>\n";
    xml += "    <GrpHdr>\n";
    xml += "      <MsgId>" + xmlEscapeText(txId) + "</MsgId>\n";
    xml += "    </GrpHdr>\n";
    xml += "    <CdtTrfTxInf>\n";
    xml += "      <PmtId>\n";
    xml += "        <InstrId>" + xmlEscapeText(txId) + "</InstrId>\n";
    xml += "        <EndToEndId>" + xmlEscapeText(isMt202 ? relRef : txId) + "</EndToEndId>\n";
    xml += "        <TxId>" + xmlEscapeText(txId) + "</TxId>\n";
    xml += "      </PmtId>\n";
    xml += "      <IntrBkSttlmAmt Ccy=\"" + xmlEscapeText(ccy) + "\">" + xmlEscapeText(amount) + "</IntrBkSttlmAmt>\n";
    xml += "    </CdtTrfTxInf>\n";
    xml += "  </FIToFICstmrCdtTrf>\n";
    xml += "</Document>";
    return xml;
}

inline std::vector<String> splitPacsXmlBatchMessages(const String& message) {
    std::vector<String> out;
    String trimmed = trimCopy(message);
    if (trimmed.length() == 0) return out;

    int txProbe = trimmed.indexOf("<CdtTrfTxInf");
    if (txProbe < 0) return out;

    int docStart = trimmed.indexOf("<Document");
    if (docStart < 0) return out;
    int docOpenEnd = trimmed.indexOf('>', docStart);
    if (docOpenEnd < 0) return out;
    String documentOpenTag = trimmed.substring(docStart, docOpenEnd + 1);

    int fiStart = trimmed.indexOf("<FIToFICstmrCdtTrf", docOpenEnd);
    if (fiStart < 0) return out;
    int fiOpenEnd = trimmed.indexOf('>', fiStart);
    if (fiOpenEnd < 0) return out;
    String fiOpenTag = trimmed.substring(fiStart, fiOpenEnd + 1);

    int fiEndStart = trimmed.indexOf("</FIToFICstmrCdtTrf>", fiOpenEnd);
    if (fiEndStart < 0) return out;

    String fiInner = trimmed.substring(fiOpenEnd + 1, fiEndStart);
    int grpStart = fiInner.indexOf("<GrpHdr");
    String grpBlock = "";
    if (grpStart >= 0) {
        int grpOpenEnd = fiInner.indexOf('>', grpStart);
        int grpCloseStart = fiInner.indexOf("</GrpHdr>", grpOpenEnd);
        if (grpOpenEnd >= 0 && grpCloseStart > grpOpenEnd) {
            grpBlock = fiInner.substring(grpStart, grpCloseStart + 9);
        }
    }

    std::vector<String> txBlocks;
    int cursor = 0;
    while (cursor >= 0 && cursor < fiInner.length()) {
        int txStart = fiInner.indexOf("<CdtTrfTxInf", cursor);
        if (txStart < 0) break;
        int txOpenEnd = fiInner.indexOf('>', txStart);
        if (txOpenEnd < 0) break;
        int txCloseStart = fiInner.indexOf("</CdtTrfTxInf>", txOpenEnd);
        if (txCloseStart < 0) break;
        txBlocks.push_back(fiInner.substring(txStart, txCloseStart + 14));
        cursor = txCloseStart + 14;
    }

    if (txBlocks.size() <= 1) return out;

    String xmlDecl = "";
    if (trimmed.startsWith("<?xml")) {
        int declEnd = trimmed.indexOf("?>");
        if (declEnd > 0) {
            xmlDecl = trimmed.substring(0, declEnd + 2);
        }
    }

    for (const String& tx : txBlocks) {
        String one;
        if (xmlDecl.length() > 0) {
            one += xmlDecl;
        } else {
            one += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>";
        }
        one += "\n";
        one += documentOpenTag;
        one += fiOpenTag;
        if (grpBlock.length() > 0) one += grpBlock;
        one += tx;
        one += "</FIToFICstmrCdtTrf></Document>";
        out.push_back(one);
    }

    return out;
}

inline void expandFanoutMessages(const String& message, std::vector<String>& outMessages) {
    outMessages.clear();

    std::vector<String> xmlSplit = splitPacsXmlBatchMessages(message);
    if (xmlSplit.size() > 1) {
        outMessages = xmlSplit;
        return;
    }

    String trimmed = trimCopy(message);
    if (trimmed.startsWith("[")) {
        JsonDocument arrDoc;
        DeserializationError arrErr = deserializeJson(arrDoc, trimmed);
        if (!arrErr && arrDoc.is<JsonArrayConst>()) {
            JsonArrayConst arr = arrDoc.as<JsonArrayConst>();
            for (JsonVariantConst item : arr) {
                String one;
                if (item.is<const char*>()) {
                    one = String(item.as<const char*>());
                } else {
                    serializeJson(item, one);
                }
                outMessages.push_back(one);
            }
            if (!outMessages.empty()) return;
        }
    }

    outMessages.push_back(message);
}
}
