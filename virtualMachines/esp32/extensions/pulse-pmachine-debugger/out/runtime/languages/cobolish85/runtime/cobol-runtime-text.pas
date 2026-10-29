service 'CobolRuntimeText';

function COBOL_RT_LENGTH(value: string): integer;
begin
  return host.string_length(value)
end;

function COBOL_RT_UPPER(value: string): string;
begin
  return host.string_upper(value)
end;

function COBOL_RT_LOWER(value: string): string;
begin
  return host.string_lower(value)
end;

function COBOL_RT_REVERSE(value: string): string;
begin
  return COBOL_RT_REVERSE_AT(value, host.string_length(value) - 1)
end;

function COBOL_RT_REVERSE_AT(value: string; index: integer): string;
begin
  if index < 0 then return '';
  return host.string_slice(value, index, index + 1) + COBOL_RT_REVERSE_AT(value, index - 1)
end;

function COBOL_RT_MAX_TEXT2(left: string; right: string): string;
begin
  if host.string_compare(left, right) > 0 then return left;
  return right
end;

function COBOL_RT_MIN_TEXT2(left: string; right: string): string;
begin
  if host.string_compare(left, right) < 0 then return left;
  return right
end;

function COBOL_RT_CHAR(value: real): string;
begin return host.cobol_char(value) end;

function COBOL_RT_ORD(value: string): integer;
begin return host.cobol_ord(value) end;

function COBOL_RT_CURRENT_DATE(): string;
begin return host.date_current() end;

post '/library';
begin
  return ''
end
end.
