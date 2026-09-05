service bridge_q_alpha_to_q_beta;
begin
  route message from "q.alpha" to "q.beta";
end;

begin
end.
