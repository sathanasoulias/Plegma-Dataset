# Plegma Dataset
A comprehensive appliance-level and aggregate electricity demand, with environmental and demographic data from 13 domestic houses in Greece


<div align="center">
    <img src="https://drive.google.com/uc?export=view&id=1HFDnDR6XdUXYvoyTNE98egjY_vTu-TIl" width="900">
</div>


### Information
Collection of this dataset was supported by the Plegma Labs, National Technical University of Athens, and University of Strathclyde via the GECKO Marie Skłodowska-Curie grant agreement No 955422. The dataset includes data from 13 households from Greece over the period September 2022 - September 2023.

### Folder Structure
Plegma Dataset contains electric, environmental, and demographic data of households that participate in the study. It is provided in both raw and preprocessed versions to allow the research community to use our preprocessing pipeline or create their own. The 'sociodemographic-building characteristics-appliances usage', external environmental data, and appliances metadata are only presented in the processed version of the dataset.
The finalized folder structure is as follows:

<div align="center">
    <img src="https://drive.google.com/uc?export=view&id=1vkkXepMEwvwaAy54HymoHWR595HO5-fh" width="900">
</div>


### Granularity
Houses are labelled from 1 to 13. Each house is equipped with up to 9 plug-level power sensors, a current clamp for the household aggregate, and an environmental sensor. Appliance-level measurements (active power in Watts) are collected at 10-second intervals. Aggregate consumption measurements (active power, voltage, and current) are at the same granularity. The environmental sensor monitors internal humidity (%) and temperature (°C) at 15-minute intervals. Hourly external weather conditions (temperature & humidity) are also provided, downsampled to 15 minutes.

### File Format and Naming Convention
The file format is CSV. The naming convention for the electric dataset includes details like voltage, current, active power, and appliances. In cases where more than one appliance of the same type exists, an increasing number follows the appliance name (i.e., ac_1).
Example naming conventions:
- Aggregate smart meter (V): Voltage
- Aggregate smart meter (A): Current
- Aggregate smart meter (W): P_agg
- Air Condition: ac
- Boiler: boiler
- Dishwasher: dishwasher
- Fridge: fridge
- Washing Machine: washing_machine

The last column, 'Issues', points to rows where the sum of monitored appliances is larger than the aggregate due to equipment error. CSV files include up to a month's measurements and are best opened with applications like Matlab.

### Missing Data
Data unavailability occurred due to internet disruptions, hardware malfunctions, and network problems.

### Data Cleaning
Data cleaning involved forward-filling small gaps of NaN values and removing values exceeding the wattage range of monitored appliances. Gaps in electric dataset (10 sec granularity) over 30 sec remained NaN, shorter gaps were forward-filled. Environmental data gaps up to 60 min were forward filled; larger gaps remained NaN.

### Appliances Metadata
The electric folder of the processed dataset includes a CSV file with appliances metadata, detailing wattage information such as cutoff, threshold, min_on, min_off.

### Link to download data
The Plegma dataset is hosted at the University of Strathclyde data portal and can be accessed through:
- DOI: https://doi.org/10.15129/3b01a6c6-2efd-424a-b8b8-5fe7fa445ded
- URL: https://pureportal.strath.ac.uk/en/datasets/plegma-dataset


