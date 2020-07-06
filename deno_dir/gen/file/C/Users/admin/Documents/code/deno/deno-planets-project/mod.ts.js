import { join } from "https://deno.land/std/path/mod.ts";
import { BufReader } from "https://deno.land/std/io/bufio.ts";
import { parse } from "https://deno.land/std/encoding/csv.ts";
import * as _ from "https://deno.land/x/lodash@4.17.15-es/lodash.js";
async function loadPlanetsData() {
    const path = join('.', 'kepler_exoplanets_nasa.csv');
    const file = await Deno.open(path);
    const bufReader = new BufReader(file);
    const result = await parse(bufReader, {
        header: true,
        comment: '#'
    });
    Deno.close(file.rid);
    const planets = result.filter((planet) => {
        const planetDisposition = planet['koi_disposition'] === 'CONFIRMED';
        const planetRadius = Number(planet['koi_prad']) > 0.5 && Number(planet['koi_prad']) < 1.5;
        const stellarMass = Number(planet['koi_smass']) > 0.78 && Number(planet['koi_smass']) < 1.04;
        const stellarRadius = Number(planet['koi_srad']) > 0.99 && Number(planet['koi_srad']) < 1.01;
        return planetDisposition && planetRadius && stellarMass && stellarRadius;
    });
    return planets.map((planet) => {
        return _.pick(planet, [
            'koi_prad',
            'koi_smass',
            'koi_srad',
            'kepler_name',
            'koi_count',
            'koi_steff',
            'koi_period'
        ]);
    });
}
const newEarths = await loadPlanetsData();
console.log(`Habbitable planets found -> ${newEarths.length}`);
for (const planet of newEarths) {
    console.log(planet);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibW9kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN6RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzlELE9BQU8sS0FBSyxDQUFDLE1BQU0saURBQWlELENBQUM7QUFNckUsS0FBSyxVQUFVLGVBQWU7SUFDNUIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSw0QkFBNEIsQ0FBQyxDQUFDO0lBRXJELE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNuQyxNQUFNLFNBQVMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QyxNQUFNLE1BQU0sR0FBRyxNQUFNLEtBQUssQ0FBQyxTQUFTLEVBQUU7UUFDcEMsTUFBTSxFQUFFLElBQUk7UUFDWixPQUFPLEVBQUUsR0FBRztLQUNiLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRXJCLE1BQU0sT0FBTyxHQUFJLE1BQW1CLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7UUFDckQsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUMsS0FBSyxXQUFXLENBQUM7UUFDcEUsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQzFGLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxJQUFJLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUM3RixNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDN0YsT0FBTyxpQkFBaUIsSUFBSSxZQUFZLElBQUksV0FBVyxJQUFJLGFBQWEsQ0FBQztJQUMzRSxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO1FBQzVCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDcEIsVUFBVTtZQUNWLFdBQVc7WUFDWCxVQUFVO1lBQ1YsYUFBYTtZQUNiLFdBQVc7WUFDWCxXQUFXO1lBQ1gsWUFBWTtTQUNiLENBQUMsQ0FBQTtJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELE1BQU0sU0FBUyxHQUFHLE1BQU0sZUFBZSxFQUFFLENBQUM7QUFFMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQywrQkFBK0IsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDL0QsS0FBSyxNQUFNLE1BQU0sSUFBSSxTQUFTLEVBQUU7SUFDOUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztDQUVyQiJ9