/* eslint-disable no-console */
import { dataSource } from '../config/data-source';

const reset = async () => {
  try {
    await dataSource.initialize();
  } catch (e) {
    console.log(e);
    console.log('Error: Could not connect to database');
    process.exit(1);
  }

  try {
    await dataSource.dropDatabase();
    console.log('Database cleared');
  } catch (e) {
    console.log(e);
    console.log('Error: Could not drop database');
    process.exit(1);
  }

  dataSource.destroy();
  process.exit();
};

reset();
