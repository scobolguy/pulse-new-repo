use "CPMNetwork";

service 'cpm-network-example';

type Work = record
  owner: string;
  cost: integer;
end;

var project: CPMNetwork<Work>;
    work: Work;

get '/api/cpm/example';
begin
  project.initialize('release');
  project.addSubnetwork('build', 'release');
  project.addSubnetwork('test', 'release');
  project.addSubnetwork('unit', 'test');

  work.owner := 'Design'; work.cost := 20;
  project.addNode('design', 2, work, 'release');
  work.owner := 'Engineering'; work.cost := 30;
  project.addNode('compile', 3, work, 'build');
  work.owner := 'QA'; work.cost := 40;
  project.addNode('verify', 4, work, 'unit');
  work.owner := 'Operations'; work.cost := 10;
  project.addNode('publish', 1, work, 'release');

  project.addDependency('design', project.entry('build'));
  project.addDependency(project.exit('build'), project.entry('test'));
  project.addDependency(project.exit('test'), 'publish');
  return project.schedule()
end
end.
