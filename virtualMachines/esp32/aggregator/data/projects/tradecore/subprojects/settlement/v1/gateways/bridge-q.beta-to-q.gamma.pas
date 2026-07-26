service bridge_q_beta_to_q_gamma;
begin
  route message from "q.beta" to "q.gamma";
end;
