service 'mapper-runtime' on local;
  get "/health" accepts JSON returns JSON;
  begin return '{"status":"ok","service":"data-mapper"}'; end
end.
