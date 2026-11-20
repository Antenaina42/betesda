const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    console.log('No clinic found');
    return;
  }

  let cat = await prisma.medicineCategory.findFirst({
    where: { name: 'Consommables & Matériel Médical' }
  });

  if (!cat) {
    cat = await prisma.medicineCategory.create({
      data: {
        name: 'Consommables & Matériel Médical',
        description: 'Gants, seringues, alcool, compresses, bétadine, pansements et matériel de soins'
      }
    });
    console.log('Category created:', cat.name);
  }

  const items = [
    { name: "Gants d'Examen Latex (Boîte 100)", genericName: 'Gants latex non poudrés', form: 'Boîte', dosage: 'Taille M', purchasePrice: 22000, sellingPrice: 30000, currentStock: 25, minStockLevel: 5, location: 'Rayon C - Étagère 1' },
    { name: "Gants d'Examen Stériles (Paire)", genericName: 'Gants chirurgicaux stériles', form: 'Paire', dosage: 'Taille 7.5', purchasePrice: 800, sellingPrice: 1500, currentStock: 150, minStockLevel: 20, location: 'Rayon C - Étagère 1' },
    { name: "Alcool Médical 70° (Flacon 500ml)", genericName: 'Alcool éthylique dénaturé 70%', form: 'Flacon', dosage: '500 ml', purchasePrice: 4500, sellingPrice: 7000, currentStock: 30, minStockLevel: 5, location: 'Rayon C - Étagère 2' },
    { name: "Alcool Médical 90° (Flacon 250ml)", genericName: 'Alcool éthylique 90%', form: 'Flacon', dosage: '250 ml', purchasePrice: 3500, sellingPrice: 5500, currentStock: 20, minStockLevel: 5, location: 'Rayon C - Étagère 2' },
    { name: "Seringue Stérile 5ml avec Aiguille", genericName: 'Seringue 3 pièces 5ml', form: 'Pièce', dosage: '5 ml / 21G', purchasePrice: 300, sellingPrice: 600, currentStock: 300, minStockLevel: 50, location: 'Rayon C - Tiroir 3' },
    { name: "Seringue Stérile 10ml avec Aiguille", genericName: 'Seringue 3 pièces 10ml', form: 'Pièce', dosage: '10 ml / 21G', purchasePrice: 400, sellingPrice: 800, currentStock: 200, minStockLevel: 40, location: 'Rayon C - Tiroir 3' },
    { name: "Seringue Stérile 20ml (Injection/Gavage)", genericName: 'Seringue 3 pièces 20ml', form: 'Pièce', dosage: '20 ml', purchasePrice: 700, sellingPrice: 1500, currentStock: 100, minStockLevel: 20, location: 'Rayon C - Tiroir 3' },
    { name: "Compresses Stériles 7.5x7.5 (Paquet)", genericName: 'Gaze hydrophile stérile', form: 'Paquet', dosage: '7.5 x 7.5 cm (x5)', purchasePrice: 600, sellingPrice: 1200, currentStock: 250, minStockLevel: 30, location: 'Rayon D - Étagère 1' },
    { name: "Coton Hydrophile (Rouleau 250g)", genericName: 'Coton hydrophile chirurgical', form: 'Rouleau', dosage: '250 g', purchasePrice: 4000, sellingPrice: 6500, currentStock: 40, minStockLevel: 10, location: 'Rayon D - Étagère 2' },
    { name: "Bétadine Jaune Dermique 10% (125ml)", genericName: 'Povidone iodée dermique 10%', form: 'Flacon', dosage: '125 ml', purchasePrice: 9000, sellingPrice: 14000, currentStock: 35, minStockLevel: 8, location: 'Rayon C - Étagère 2' },
    { name: "Cathéter Intraveineux G20 (Rose)", genericName: 'Cathéter IV sécurisé', form: 'Pièce', dosage: 'G20 / 32mm', purchasePrice: 1200, sellingPrice: 2500, currentStock: 120, minStockLevel: 25, location: 'Rayon C - Tiroir 4' },
    { name: "Perfuseur avec Régulateur & Aiguille", genericName: 'Tubulure de perfusion stérile', form: 'Pièce', dosage: 'Standard', purchasePrice: 1500, sellingPrice: 3000, currentStock: 80, minStockLevel: 15, location: 'Rayon C - Tiroir 4' },
    { name: "Sparadrap Microporeux Adhésif (Rouleau)", genericName: 'Bande adhésive microporeuse', form: 'Rouleau', dosage: '5m x 2.5cm', purchasePrice: 2000, sellingPrice: 3500, currentStock: 50, minStockLevel: 10, location: 'Rayon D - Étagère 1' }
  ];

  for (const it of items) {
    const existing = await prisma.medicine.findFirst({
      where: { name: it.name, clinicId: clinic.id }
    });
    if (!existing) {
      await prisma.medicine.create({
        data: {
          ...it,
          clinicId: clinic.id,
          categoryId: cat.id
        }
      });
      console.log('Created consumable:', it.name);
    }
  }

  console.log('Consumables seeded successfully!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
