import shanghai from './shanghai.json';
import beijing from './beijing.json';
import shenzhen from './shenzhen.json';
import guangzhou from './guangzhou.json';
import type { CityData } from '../types';
import { validateCity } from '../lib/validate';

// Add a CityData JSON file here. No changes to the map, route finder or storage are needed.
export const cities: CityData[] = [shanghai, beijing, shenzhen, guangzhou].map(validateCity);
