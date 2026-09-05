SERVICE "helloService";
BEGIN
  CASE httpVerb OF
    httpVerb.post: RETURN src;
    httpVerb.get: RETURN "hello, world";
  END;
END;

ROUTER "helloService-http" INPUT "helloService.in" DESCRIPTION "Return hello, world for GET" ENABLED TRUE SERVICE "helloService" BEGIN
  OUTPUT "helloService.out"
    WHEN "IF upper(httpVerb) = 'GET' THEN output := 1 ELSE output := 0;"
    TRANSFORM "output := 'hello, world';";
END;

begin
end.
