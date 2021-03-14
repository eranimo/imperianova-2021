import { times } from 'lodash';
import { Coord } from 'src/types';
import { EntityManager, Component, System, Query, Entity } from '../EntityManager';
import { EntityRef } from '../fields';

test('setup', () => {
  const manager = new EntityManager();
  expect(manager.stats.value.entityCount).toBe(0);
});

type Coordinate = {
  x: number,
  y: number,
};

describe('Entity', () => {
  let manager: EntityManager;
  beforeEach(() => {
    manager = new EntityManager();
  });

  test('creating', () => {
    manager.createEntity();
    expect(manager.stats.value.entityCount).toBe(0);
    manager.update();
    expect(manager.stats.value.entityCount).toBe(1);
  });

  it('adding components', () => {
    const Position = new Component<Coordinate>('Position')
    const entity = manager.createEntity();
    manager.registerComponent(Position);
    entity.addComponent(Position, ({ x: 2, y: 1 }));
  });

  it('removing components', () => {
    const Position = new Component<Coordinate>('Position')
    const entity = manager.createEntity();
    manager.registerComponent(Position);
    entity.addComponent(Position, ({ x: 2, y: 1 }));

    entity.removeComponent(Position);
    expect(manager.stats.value.entityCount).toBe(0);
  });

  it('updating component', () => {
    const Test = new Component<{
      num: number,
    }>('Position')
    const entity = manager.createEntity();
    manager.registerComponent(Test);
    entity.addComponent(Test, ({
      num: 1,
    }));

    const pos = entity.getComponent(Test);
    expect(pos.id).toBeDefined();
    expect(pos.value.num).toBe(1);
    pos.value.num++;
    entity.getComponent(Test).set('num', 2);
    expect(pos.get('num')).toBe(2);
  });

  it('changes', () => {
    const Position = new Component<Coordinate>('Position')
    const entity = manager.createEntity();
    manager.registerComponent(Position);
    const pos = entity.addComponent(Position, ({ x: 2, y: 1 }));
    expect(pos.changed.has('x')).toBe(false);
    pos.value.x++;
    expect(pos.changed.has('x')).toBe(true);
    manager.update();
    expect(pos.changed.has('x')).toBe(false);
  });

  it('export, reset, and import', () => {

    // export
    const Position = new Component<Coordinate>('Position')
    const entity = manager.createEntity();
    manager.registerComponent(Position);
    const pos = entity.addComponent(Position, ({ x: 1, y: 1 }));
    expect(pos.entity.id).toBe(entity.id);

    const exported = manager.export();
    expect(exported).toEqual({
      ticks: 0,
      components: {
        Position: [
          {
            id: pos.id,
            entityID: entity.id,
            type: 'Position',
            values: {
              x: 1,
              y: 1,
            },
          }
        ]
      }
    });

    manager.reset();
    expect(manager.stats.value.entityCount).toBe(0);

    manager.import(exported);
    expect(manager.stats.value.entityCount).toBe(1);
    expect(manager.hasEntity(entity.id)).toBe(true);
    const e = manager.getEntity(entity.id);
    expect(e.getComponent(Position).value).toEqual({
      x: 1,
      y: 1,
    });
  });

  describe('references', () => {
    let Body: Component<{
      race: 'human' | 'elf' | 'dwarf'
      head: EntityRef,
      fingers?: {
        pinky: EntityRef,
        thumb: EntityRef,
      },
    }>;
    let Head: Component<{
      size: 'small' | 'large',
    }>;
    let Finger: Component<{
      isBroken: boolean,
    }>;

    beforeEach(() => {
      Body = new Component('Body');
      Head = new Component('Head');
      Finger = new Component('Finger');
      manager.registerComponent(Body);
      manager.registerComponent(Head);
      manager.registerComponent(Finger);
    });

    it('creating and removing EntityRef', () => {
      const bodyEntity = manager.createEntity('body');
      const headEntity = manager.createEntity('head');
      const head = headEntity.addComponent(Head, { size: 'small' });
      const body = bodyEntity.addComponent(Body, {
        race: 'human',
        head: headEntity.createRef(),
      });

      expect(body.get('race')).toBe('human');
      expect(body.get('head')).toBeInstanceOf(EntityRef);
      expect(body.get('head').valueOf()).toBe(headEntity.id);
      expect(body.get('head').value).toBeInstanceOf(Entity);

      // deleting referenced Entity sets property to null
      headEntity.remove();
      manager.update();
      expect(body.get('head').value).toBe(null);
    });

    it('creating and removing EntityMap', () => {
      const bodyEntity = manager.createEntity('body');
      const headEntity = manager.createEntity('head');
      const thumbEntity = manager.createEntity('thumb');
      const pinkyEntity = manager.createEntity('pinky');
      const head = headEntity.addComponent(Head, { size: 'small' });
      const thumb = thumbEntity.addComponent(Finger, { isBroken: false });
      const pinky = pinkyEntity.addComponent(Finger, { isBroken: false });
      const body = bodyEntity.addComponent(Body, {
        race: 'human',
        head: headEntity.createRef(),
        fingers: {
          thumb: thumbEntity.createRef(),
          pinky: pinkyEntity.createRef(),
        },
      });
    });

    it('export and import works with EntityRef and EntityMap', () => {
      const bodyEntity = manager.createEntity('body');
      const headEntity = manager.createEntity('head');
      const thumbEntity = manager.createEntity('thumb');
      const pinkyEntity = manager.createEntity('pinky');
      const head = headEntity.addComponent(Head, { size: 'small' });
      const thumb = thumbEntity.addComponent(Finger, { isBroken: false });
      const pinky = pinkyEntity.addComponent(Finger, { isBroken: false });
      const body = bodyEntity.addComponent(Body, {
        race: 'human',
        head: headEntity.createRef(),
        fingers: {
          thumb: thumbEntity.createRef(),
          pinky: pinkyEntity.createRef(),
        },
      });
      const exported = manager.export();
      expect(exported.components.Body).toHaveLength(1);
      expect(exported.components.Head).toHaveLength(1);
      expect(exported.components.Finger).toHaveLength(2);
      expect(exported.components).toEqual({
        Head: [
          {
            id: head.id,
            type: 'Head',
            entityID: headEntity.id,
            values: {
              size: 'small',
            }
          }
        ],
        Body: [
          {
            id: body.id,
            type: 'Body',
            entityID: bodyEntity.id,
            values: {
              race: 'human',
              head: {
                __type: 'EntityRef',
                value: headEntity.id,
              },
              fingers: {
                thumb: {
                  __type: 'EntityRef',
                  value: thumbEntity.id,
                },
                pinky: {
                  __type: 'EntityRef',
                  value: pinkyEntity.id,
                },
              }
            }
          }
        ],
        Finger: [
          {
            id: thumb.id,
            type: 'Finger',
            entityID: thumbEntity.id,
            values: {
              isBroken: false,
            },
          },
          {
            id: pinky.id,
            type: 'Finger',
            entityID: pinkyEntity.id,
            values: {
              isBroken: false,
            },
          }
        ]
      })
      manager.import(exported);
      expect(manager.getEntity(bodyEntity.id).getComponent(Body).value.race).toBe('human');
    });
  });
});

describe('System', () => {
  let manager: EntityManager;
  let Position: Component<Coordinate>;
  let Velocity: Component<Coordinate>;
  beforeEach(() => {
    manager = new EntityManager();
    Position = new Component<Coordinate>('Position');
    Velocity = new Component<Coordinate>('Velocity');
    manager.registerComponent(Position);
    manager.registerComponent(Velocity);
  });

  it('setup system', () => {
    let count = 0;
    class BasicSystem extends System {
      update() {
        count++;
      }
    }
    const basicSystem = new BasicSystem();
    const update = jest.spyOn(basicSystem, 'update');
    manager.registerSystem(basicSystem);
    manager.update();
    expect(count).toBe(1);
    expect(update).toBeCalled();
  });

  it('query', () => {
    let added = jest.fn();
    let removed = jest.fn();
    class MovementSystem extends System {
      query: Query;

      init(manager: EntityManager) {
        this.query = manager.createQuery(entity => 
          entity.hasComponent(Position) && entity.hasComponent(Velocity)
        );
        this.query.onEntityAdded.connect(() => {
          added();
        });
        this.query.onEntityRemoved.connect(() => {
          removed();
        });
      }

      update() {
        for (const entity of this.query.entities) {
          const pos = entity.getComponent(Position);
          const vel = entity.getComponent(Velocity);
          pos.set('x', pos.get('x') + vel.get('x'));
          pos.set('y', pos.get('y') + vel.get('y'));
        }
      }
    }
    const movementSystem = new MovementSystem();
    manager.registerSystem(movementSystem);

    const entity = manager.createEntity();
    const pos = entity.addComponent(Position, { x: 0, y: 0 });
    entity.addComponent(Velocity, { x: 1, y: 1 });
    expect(added.mock.calls.length).toBe(1);

    times(10, () => manager.update());
    expect(pos.value.x).toBe(10);
    expect(pos.value.y).toBe(10);

    entity.removeComponent(Velocity);

    expect(removed.mock.calls.length).toBe(1);
  });

  it('entity updates', () => {
    const hasChanged = jest.fn();
    class BasicSystem extends System {
      query: Query;

      init(manager: EntityManager) {
        this.query = manager.createQuery(entity => 
          entity.hasComponent(Position)
        );
      }

      update() {
        for (const entity of this.query.entities) {
          const pos = entity.getComponent(Position);
          if (pos.changed.has('x') || pos.changed.has('y')) {
            hasChanged();
          }
        }
      }
    }
    manager.registerSystem(new BasicSystem());

    const entity = manager.createEntity();
    const pos = entity.addComponent(Position, { x: 0, y: 0 });

    pos.value.x++;
    manager.update();
    manager.update();
    expect(hasChanged.mock.calls.length).toBe(1);
  });
});