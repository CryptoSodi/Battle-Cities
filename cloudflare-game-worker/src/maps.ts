import map01 from '../../data/maps/original/01.json';
import map02 from '../../data/maps/original/02.json';
import map03 from '../../data/maps/original/03.json';
import map04 from '../../data/maps/original/04.json';
import map05 from '../../data/maps/original/05.json';
import map06 from '../../data/maps/original/06.json';
import map07 from '../../data/maps/original/07.json';
import map08 from '../../data/maps/original/08.json';
import map09 from '../../data/maps/original/09.json';
import map10 from '../../data/maps/original/10.json';
import map11 from '../../data/maps/original/11.json';
import map12 from '../../data/maps/original/12.json';
import map13 from '../../data/maps/original/13.json';
import map14 from '../../data/maps/original/14.json';
import map15 from '../../data/maps/original/15.json';
import map16 from '../../data/maps/original/16.json';
import map17 from '../../data/maps/original/17.json';
import map18 from '../../data/maps/original/18.json';
import map19 from '../../data/maps/original/19.json';
import map20 from '../../data/maps/original/20.json';
import map21 from '../../data/maps/original/21.json';
import map22 from '../../data/maps/original/22.json';
import map23 from '../../data/maps/original/23.json';
import map24 from '../../data/maps/original/24.json';
import map25 from '../../data/maps/original/25.json';
import map26 from '../../data/maps/original/26.json';
import map27 from '../../data/maps/original/27.json';
import map28 from '../../data/maps/original/28.json';
import map29 from '../../data/maps/original/29.json';
import map30 from '../../data/maps/original/30.json';
import map31 from '../../data/maps/original/31.json';
import map32 from '../../data/maps/original/32.json';
import map33 from '../../data/maps/original/33.json';
import map34 from '../../data/maps/original/34.json';
import map35 from '../../data/maps/original/35.json';
import type { SimulationMapDto } from '../../shared/src/simulationProtocol';

const maps: SimulationMapDto[] = [
  map01, map02, map03, map04, map05, map06, map07, map08, map09, map10,
  map11, map12, map13, map14, map15, map16, map17, map18, map19, map20,
  map21, map22, map23, map24, map25, map26, map27, map28, map29, map30,
  map31, map32, map33, map34, map35,
] as SimulationMapDto[];

export function getMap(level: number): SimulationMapDto {
  const index = (Math.max(1, Math.floor(level)) - 1) % maps.length;
  return maps[index];
}
