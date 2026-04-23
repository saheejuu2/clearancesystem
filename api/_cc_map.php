<?php
// Shared cost center → chrgcode mapping
// Based on actual hcharge table data
$CC_CHRGCODE_MAP = [
    'Laboratory'                   => ['LABOR', 'LABSO'],
    'Radiology'                    => ['RADIO', 'PROC', 'ULTRA', 'XRAY'],
    'Pharmacy'                     => ['DRUME', 'PHARM', 'MED', 'MED1'],
    'Bloodbank'                    => ['BLOOD'],
    'Operating Room/Delivery Room' => ['OPERA', 'MOR', 'DR'],
    'Hemodialysis Unit'            => ['DIA'],
    'Pulmonary Department (MSA)'   => ['MSA', 'PUL'],
    'Newborn Screening'            => ['NEW'],
    'Newborn Hearing Test'         => ['HEAR'],
    'Endoscopy'                    => ['ENDO'],
    'Colonoscopy'                  => ['ENDO', 'LAPA'],
    'Physical Therapy'             => ['PhyTh', 'PHYSI', 'PT'],
    'MAB'                          => ['MAB'],
];
?>
