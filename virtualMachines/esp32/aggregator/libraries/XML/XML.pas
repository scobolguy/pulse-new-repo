program "XML";
class XMLDocument;
  handle: integer;

  procedure load(value: string);
  begin self.handle := host.xml_parse(value) end;

  function count(): integer;
  begin return host.xml_count(self.handle) end;

  function appendDocument(donor: integer): integer;
  begin return host.xml_append_document(self.handle, donor) end;

  function parentNode(node: integer): integer;
  begin return host.xml_parent(self.handle, node) end;

  function localName(node: integer): string;
  begin return host.xml_local_name(self.handle, node) end;

  function namespaceURI(node: integer): string;
  begin return host.xml_namespace(self.handle, node) end;

  function attribute(node: integer; name: string): string;
  begin return host.xml_attribute(self.handle, node, name) end;

  function attributeInteger(node: integer; name: string; fallback: integer): integer;
  begin return host.xml_attribute_integer(self.handle, node, name, fallback) end;

  function qualifiedLocal(node: integer; value: string): string;
  begin return host.xml_qname_local(self.handle, node, value) end;

  function qualifiedNamespace(node: integer; value: string): string;
  begin return host.xml_qname_namespace(self.handle, node, value) end;

  function firstChild(node: integer): integer;
  begin return host.xml_first_child(self.handle, node) end;

  function nextSibling(node: integer): integer;
  begin return host.xml_next_sibling(self.handle, node) end;

  function subtreeEnd(node: integer): integer;
  begin return host.xml_end(self.handle, node) end;

  function textValue(node: integer): string;
  begin return host.xml_text(self.handle, node) end;
end;
begin
end.
