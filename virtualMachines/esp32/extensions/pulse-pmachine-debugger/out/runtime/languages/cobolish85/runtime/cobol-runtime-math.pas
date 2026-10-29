service 'CobolRuntimeMath';

function COBOL_RT_ACOS(value: real): real;
begin return host.math_acos(value) end;

function COBOL_RT_ASIN(value: real): real;
begin return host.math_asin(value) end;

function COBOL_RT_ATAN(value: real): real;
begin return host.math_atan(value) end;

function COBOL_RT_COS(value: real): real;
begin return host.math_cos(value) end;

function COBOL_RT_SIN(value: real): real;
begin return host.math_sin(value) end;

function COBOL_RT_TAN(value: real): real;
begin return host.math_tan(value) end;

function COBOL_RT_LOG(value: real): real;
begin return host.math_log(value) end;

function COBOL_RT_LOG10(value: real): real;
begin return host.math_log10(value) end;

function COBOL_RT_SQRT(value: real): real;
begin return host.math_sqrt(value) end;

function COBOL_RT_FACTORIAL(value: real): real;
begin return host.math_factorial(value) end;

function COBOL_RT_INTEGER(value: real): real;
begin return host.math_floor(value) end;

function COBOL_RT_INTEGER_PART(value: real): real;
begin return host.math_trunc(value) end;

function COBOL_RT_MOD(left: real; right: real): real;
begin return host.math_mod(left, right) end;

function COBOL_RT_REM(left: real; right: real): real;
begin return host.math_rem(left, right) end;

function COBOL_RT_MEAN(values: string): real;
begin return host.math_mean(values) end;

function COBOL_RT_MEDIAN(values: string): real;
begin return host.math_median(values) end;

function COBOL_RT_MIDRANGE(values: string): real;
begin return host.math_midrange(values) end;

function COBOL_RT_RANGE(values: string): real;
begin return host.math_range(values) end;

function COBOL_RT_SUM(values: string): real;
begin return host.math_sum(values) end;

function COBOL_RT_VARIANCE(values: string): real;
begin return host.math_variance(values) end;

function COBOL_RT_STANDARD_DEVIATION(values: string): real;
begin return host.math_standard_deviation(values) end;

function COBOL_RT_ORD_MAX(values: string): integer;
begin return host.math_ord_max(values) end;

function COBOL_RT_ORD_MIN(values: string): integer;
begin return host.math_ord_min(values) end;

function COBOL_RT_NUMVAL(value: string): real;
begin return host.math_numval(value) end;

function COBOL_RT_NUMVAL_C(value: string): real;
begin return host.math_numval_c(value) end;

function COBOL_RT_NUMVAL_C_WITH_CURRENCY(value: string; currency_sign: string): real;
begin return host.math_numval_c_currency(value, currency_sign) end;

function COBOL_RT_INTEGER_OF_DATE(value: real): integer;
begin return host.math_integer_of_date(value) end;

function COBOL_RT_DATE_OF_INTEGER(value: real): integer;
begin return host.math_date_of_integer(value) end;

function COBOL_RT_INTEGER_OF_DAY(value: real): integer;
begin return host.math_integer_of_day(value) end;

function COBOL_RT_DAY_OF_INTEGER(value: real): integer;
begin return host.math_day_of_integer(value) end;

function COBOL_RT_ANNUITY(rate: real; periods: real): real;
begin return host.math_annuity(rate, periods) end;

function COBOL_RT_PRESENT_VALUE(values: string): real;
begin return host.math_present_value(values) end;

function COBOL_RT_RANDOM(): real;
begin return host.math_random() end;

function COBOL_RT_RANDOM_SEEDED(seed: real): real;
begin return host.math_random_seeded(seed) end;

post '/library';
begin return '' end
end.
