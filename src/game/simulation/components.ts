import { Component } from 'ape-ecs';
import { Direction, Coord } from '../../types';

export class FrameInfo extends Component {
  static properties = {
    deltaTime: 0,
    time: 0,
  }
}

export class Date extends Component {
  static changeEvents = true;
  static properties = {
    dateTicks: 0,
  }
}

export class HexPosition extends Component {
  static properties: {
    x: number,
    y: number,
  } = {
    x: null,
    y: null,
  };
}

export class Road extends Component {
  static changeEvents = true;
  static properties: {
    coord: Coord,
    roadEdges: Partial<Record<Direction, boolean>>,
  } = {
    coord: null,
    roadEdges: {},
  };
}
