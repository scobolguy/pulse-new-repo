import { SwarmLeadershipWitness } from './swarmLeadershipWitness.mjs';
import { SwarmTaskCoordinator } from './swarmTaskCoordinator.mjs';
import { SwarmResourceRegistry } from './swarmResourceRegistry.mjs';

// Recoverable state is published only by the witness, not the admission journal.
export class WitnessedTaskAdmission {
  #coordinator;
  #witness;
  #leadership;
  #resources;

  constructor({ witness, resources, ...options }) {
    if (!(witness instanceof SwarmLeadershipWitness)) throw new Error('An aggregator witness is required');
    if (options.authorizeMutation !== undefined) throw new Error('Admission authority cannot be overridden');
    this.#witness = witness;
    if (resources !== undefined && (!(resources instanceof SwarmResourceRegistry) ||
        resources.clusterId !== witness.clusterId))
      throw new Error('Admission resources must belong to the witnessed swarm');
    this.#resources = resources;
    this.#coordinator = new SwarmTaskCoordinator({
      ...options,
      authorizeMutation: () => {
        if (!this.#leadership) throw new Error('Task mutation requires witnessed leadership');
        this.#witness.authorize(this.#leadership);
        return this.#leadership;
      },
    });
  }

  #run(token, action) {
    this.#witness.authorize(token);
    if (this.#leadership) throw new Error('Nested admission mutation is not allowed');
    this.#leadership = { clusterId: token.clusterId, managerId: token.managerId, epoch: token.epoch };
    try {
      return action();
    } finally {
      this.#leadership = undefined;
    }
  }

  get(taskId) { return this.#coordinator.get(taskId); }
  submit(leader, task) { return this.#run(leader, () => this.#coordinator.submit(task)); }
  claim(leader, taskId, nodes) {
    if (this.#resources && nodes !== undefined) throw new Error('Caller resource overrides are not allowed');
    return this.#run(leader, () => this.#coordinator.claim(
      taskId, this.#resources ? this.#resources.candidates() : nodes,
    ));
  }
  renew(leader, task) { return this.#run(leader, () => this.#coordinator.renew(task)); }
  complete(leader, task, result) { return this.#run(leader, () => this.#coordinator.complete(task, result)); }
  fail(leader, task, failure) { return this.#run(leader, () => this.#coordinator.fail(task, failure)); }
  cancel(leader, taskId) { return this.#run(leader, () => this.#coordinator.cancel(taskId)); }
  expireLeases(leader) { return this.#run(leader, () => this.#coordinator.expireLeases()); }

  async publish(leader, worker, expectedSequence, state) {
    const manager = { clusterId: leader?.clusterId, managerId: leader?.managerId, epoch: leader?.epoch };
    const owner = {
      id: worker?.id, owner: worker?.owner, epoch: worker?.epoch, leadershipEpoch: worker?.leadershipEpoch,
    };
    const task = this.#run(manager, () => this.#coordinator.owned(owner));
    return this.#witness.publish(manager, {
      taskId: task.id, codeId: task.codeId, expectedSequence, state,
    }, {
      authorizeWorker: () => {
        this.#run(manager, () => this.#coordinator.owned(owner));
        return true;
      },
    });
  }

  async restore(leader, worker) {
    const manager = { clusterId: leader?.clusterId, managerId: leader?.managerId, epoch: leader?.epoch };
    const owner = {
      id: worker?.id, owner: worker?.owner, epoch: worker?.epoch, leadershipEpoch: worker?.leadershipEpoch,
    };
    const task = this.#run(manager, () => this.#coordinator.owned(owner));
    const restored = await this.#witness.readCommitted(manager, task.id, task.codeId);
    this.#run(manager, () => this.#coordinator.owned(owner));
    return restored;
  }
}
