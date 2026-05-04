import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_SOURCE = '/Users/ahmadjalil/Downloads/family tree/app/MacFamilyTree 11/Contents/Frameworks/MacFamilyTreeCore.framework/Versions/A/Resources';
const sourceDir = process.argv[2] || DEFAULT_SOURCE;
const targetDir = path.resolve('public/mft-models');

const genders = ['Female', 'Male', 'Unknown'];
const suffixes = ['', 'Cartoon', 'Gender', 'Flat', 'FamilySearch'];
const files = genders.flatMap((gender) => (
  suffixes.map((suffix) => `InteractiveTreePerson${gender}${suffix}.dae`)
));

await mkdir(targetDir, { recursive: true });

for (const file of files) {
  await copyFile(path.join(sourceDir, file), path.join(targetDir, file));
}

console.log(`Synced ${files.length} MacFamilyTree 3D model assets to ${targetDir}`);
