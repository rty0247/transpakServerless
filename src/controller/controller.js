const crate = require('../data/crate.json');
const floater = require('../data/floater.json');
const barrier = require('../data/barrier.json');
const blocking = require('../data/blocking.json');
const materials = require('../data/material.json');
const contributionMargin = 0.48;



exports.getTotalCost = async (req, res) => {
    try {
        const calculationType = 'New';
        const { ilength, iwidth, iheight } = getLWHfromReqBody(req.body);
        const ift3 = calculateFt3(ilength, iwidth, iheight);
        const inputDimensions = { ilength, iwidth, iheight, ift3 };
        const complexityMap = extractFeatureMap(req.body.complexity);
        const componentsMap = extractComponentsMap(req.body.components);
        const materialCosts = processComponents(componentsMap, inputDimensions);
        const estimatedMaterialCost = calculateEstimatedMaterialCost(materialCosts, componentsMap);
        const finalEstimatedLabourCost = calculateFinalEstimatedLabourAndMaterialCost(estimatedMaterialCost, complexityMap, calculationType);
        const finalCost = calculateFinalCost(finalEstimatedLabourCost);
        const finalSellPrice = calculateFinalSellPrice(finalCost, contributionMargin);
        //console.log('Final Sell Price : ', finalSellPrice);
        res.status(200).json({
            sellPrice: finalSellPrice
        });
    } catch (error) {
        console.error('Error fetching Total Cost:', error);
        res.status(500).json({
            statusCode: 500,
            message: 'An error occurred while fetching Total Cost.',
            error: error.message
        });
    }
};

function getLWHfromReqBody(event) {
    const { length, width, height } = event.dimensions;

    // Ensure dimensions are provided and are valid numbers
    if (!length || !width || !height || isNaN(length) || isNaN(width) || isNaN(height)) {
        throw new Error('Invalid dimensions provided. Please provide valid length, width, and height.');
    }

    const ilength = length;
    const iwidth = width;
    const iheight = height;

    return { ilength, iwidth, iheight };
}

function getOLWHfromData(ilength, iwidth, iheight, objectMap) {
    // Ensure dimensions are provided and are valid numbers
    if (!ilength || !iwidth || !iheight || isNaN(ilength) || isNaN(iwidth) || isNaN(iheight)) {
        throw new Error('Invalid dimensions provided. Please provide valid ilength, iwidth, and iheight.');
    }
    const il1 = findItemsInMaterialList('Thickness', 'Crate7', 'End Panels', 'PLY, 3/8', objectMap);
    const il2 = findItemsInMaterialList('Thickness', 'Crate8', 'Cleat, Thru-Edge', 'LBR, 1X4', objectMap);
    const iw1 = findItemsInMaterialList('Thickness', 'Crate3', 'Side Panels', 'PLY, 3/8',objectMap);
    const iw2 = findItemsInMaterialList('Thickness', 'Crate4', 'Cleat, Thru-Edge', 'LBR, 1X4', objectMap);
    const ih1 = findItemsInMaterialList('Thickness', 'Crate1', 'Skid', 'LBR, 4X4', objectMap);
    const ih2 = findItemsInMaterialList('Thickness', 'Crate2', 'Floorboard', 'LBR, 2X10', objectMap);
    const ih3 = findItemsInMaterialList('Thickness', 'Crate11', 'Top Panel', 'PLY, 3/8', objectMap);
    const ih4 = findItemsInMaterialList('Thickness', 'Crate12', 'Cleat, Thru-Edge', 'LBR, 1X4', objectMap);

    const olength = ilength + ((il1 + il2) * 2) ?? 0;
    const owidth = iwidth + ((iw1 + iw2) * 2) ?? 0;
    const oheight = (iheight + ih1 + ih2 + ih3 + ih4) ?? 0;

    return { olength, owidth, oheight };
}

function extractFeatureMap(features) {
    const featureMap = {};

    // Check if features is defined and is an array before iterating
    if (features && Array.isArray(features)) {
        features.forEach(feature => {
            featureMap[feature.title] = feature.isActive === 1; // Convert isActive to boolean
        });
    }

    return featureMap;
}

function extractComponentsMap(components) {
    const componentsMap = {};

    Object.keys(components).forEach(category => {
        components[category].forEach(component => {
            componentsMap[component.title] = component.isActive === 1; // Convert isActive to boolean
        });
    });

    return componentsMap;
}

function getObjectByKey(key, object) {
    //Get the entire material object based on Material
    //Get the entire Crate or any other component from the entire list of components
    return object[key] || null;
  }

function getObjectByMaterial(material, componentObject) {
    const foundObject = componentObject.find(obj => obj.Material === material);
    return foundObject || null;
  }

function calculateFt3(length, width, height) {
    const ft3 = 0;
    if (!isNaN(length) && !isNaN(width) && !isNaN(height)) {
       return parseFloat(((length * width * height) / 1728));
    }
    return ft3;
}

function calculateQtyUomList(listAfterCalculatingQuantity) {
    listAfterCalculatingQuantity.forEach(item => {
        let qtyUom = 0;
        if (item.UOM === 'BF') {
            qtyUom = (item.Quantity * item.Length * item.NomW * item.NomT / 144) * (1 + item.Scrap);
        } else if (item.UOM === 'SF') {
            qtyUom = (item.Quantity * item.Length * item.Width / 144) * (1 + item.Scrap);
        } else if (item.UOM === 'EA') {
            qtyUom = item.Quantity;
        }
        item.qtyUom = parseFloat(qtyUom);
    });

    return listAfterCalculatingQuantity;
}

function calculateCost(listAfterCalculatingQtyUom) {
    listAfterCalculatingQtyUom.forEach(item => {
        let totalCost = 0;
        totalCost = item.qtyUom * item.perUom ?? 0;
        item.totalCost = parseFloat(totalCost);
    });

    return listAfterCalculatingQtyUom;
}

function calculateMaterialCost(list) {
    let cost = 0;

    list.forEach(item => {
        if (item.totalCost && typeof item.totalCost === 'number') {
            cost += item.totalCost;
        }
    });

    return cost;
};


function getBasicStructuredList(obj) {
    let priceObject = [];
    try {
        const componentObj = obj.componentObject;
        const materialObjectMap = obj.materials;        
        componentObj.forEach(component => {
            const materialKey = component.Material;
            const materialObject = materialObjectMap[materialKey];

            if (materialObject) {
                let newObject = {
                    Title: component.Title,
                    Description: component.Description,
                    Material: component.Material,
                    Thickness: materialObject.ActT || 0,
                    Scrap: materialObject.SCRAP || 0,
                    UOM: component.UOM,
                    perUom: materialObject.UNIT_PRICE || 0,
                    NomW: materialObject.NomW || 0,
                    NomT: materialObject.NomT || 0,
                    ActW: materialObject.ActW || 0
                };

                // Conditionally assign Width if component.Width is "MatList"
                if (component.Width === "MatList") {
                    newObject.Width = materialObject.ActW;
                }else if(component.Width === 0.0){
                    newObject.Width = 0;
                }else{
                    newObject.Width = component.Width;
                }

                if(component.Length === 0.0){
                    newObject.Length = 0;
                }else{
                    newObject.Length = component.Length;
                }

                newObject.Quantity = component.Quantity;

                priceObject.push(newObject);
            }
        });
    } catch (error) {
        console.error('Error in getObjectsList:', error);
    }
    return priceObject;
}

const findItemsInMaterialList = (part, title, description, material, basicList) => {
    //console.log(part, 'PART');
    //console.log(title, 'TITLE');
    //console.log(description, 'DESCRIPTION');
    //console.log(material, 'MATERIAL');
    const item = basicList.find(component => 
        component.Title === title && 
        component.Description === description && 
        component.Material === material
    );
    return item ? item[part] : 0;
};

const findItemsInMaterialListOfList = (part, title, description, material, basicList) => {
    // Check if basicList is an array and not empty
    if (!Array.isArray(basicList) || basicList.length === 0) {
        return 0; // or handle this case as per your requirement
    }

    // Initialize item to null
    let item = null;

    // Iterate through each list in basicList until item is found
    for (let list of basicList) {
        // Check if list is an array and has the find method
        if (Array.isArray(list) && typeof list.find === 'function') {
            item = list.find(component =>
                component.Title === title &&
                component.Description === description &&
                component.Material === material
            );

            // If item is found, break out of the loop
            if (item) {
                break;
            }
        }
    }

    // Return the value of part if item is found, otherwise return 0
    return item ? item[part] : 0;
};




const calculateWidth = (objectMap, inputDimensions, outputDimensions, dummyList) => {
    const { ilength, iwidth, iheight, ift3 } = inputDimensions;
    const { olength, owidth, oheight, oft3 } = outputDimensions;

    objectMap.forEach(item => {
        if (typeof item.Width === 'string') {
            let formula = item.Width
                .replace(/ilength/g, ilength)
                .replace(/iwidth/g, iwidth)
                .replace(/iheight/g, iheight)
                .replace(/ift3/g, ift3)
                .replace(/olength/g, olength)
                .replace(/owidth/g, owidth)
                .replace(/oheight/g, oheight)
                .replace(/oft3/g, oft3);
            formula = formula.replace(/findItemsInMaterialList\(([^)]+)\)/g, (_, args) => {
                const parsedArgs = args.match(/'([^']+)'|"([^"]+)"|([^,]+)/g).map(arg => arg.trim().replace(/^['"]|['"]$/g, ''));
                const part = parsedArgs[0];
                const title = parsedArgs[1];
                const description = parsedArgs[2];
                const material = parsedArgs.slice(3,5).join(', ').trim();
                
                // First try to find in objectMap
                let result = findItemsInMaterialList(part, title, description, material, objectMap);

                // If not found in objectMap, search in dummyList
                if (!result && dummyList) {
                    result = findItemsInMaterialListOfList(part, title, description, material, dummyList);
                }

                return result;
            });
            try {
                const calculate = new Function('objectMap', `return ${formula}`);
                item.Width = calculate(objectMap);
            } catch (e) {
                console.error(`Error evaluating formula for item: ${item.Title} ${item.Description} ${item.Material}`, e);
                item.Width = null; // or handle the error as needed
            }
        }
    });

    return objectMap;
};



const calculateLength = (objectMap, inputDimensions, outputDimensions, dummyList) => {
    const { ilength, iwidth, iheight, ift3 } = inputDimensions;
    const { olength, owidth, oheight, oft3 } = outputDimensions;

    objectMap.forEach(item => {
        if (typeof item.Length === 'string') {
            let formula = item.Length
                .replace(/ilength/g, ilength)
                .replace(/iwidth/g, iwidth)
                .replace(/iheight/g, iheight)
                .replace(/ift3/g, ift3)
                .replace(/olength/g, olength)
                .replace(/owidth/g, owidth)
                .replace(/oheight/g, oheight)
                .replace(/oft3/g, oft3);

            formula = formula.replace(/findItemsInMaterialList\(([^)]+)\)/g, (_, args) => {
                const parsedArgs = args.match(/'([^']+)'|"([^"]+)"|([^,]+)/g).map(arg => arg.trim().replace(/^['"]|['"]$/g, ''));
                let part = parsedArgs[0];
                let title = parsedArgs[1];
                let description, material;

                if (parsedArgs.length >= 5 && parsedArgs[2].includes('Cleat')) {
                    description = parsedArgs.slice(2, 4).join(', ').trim();
                    material = parsedArgs.slice(4,6).join(', ').trim();
                } else {
                    description = parsedArgs[2];
                    material = parsedArgs.slice(3,5).join(', ').trim();
                }

                let result = findItemsInMaterialList(part, title, description, material, objectMap);

                if (!result && dummyList) {
                    result = findItemsInMaterialListOfList(part, title, description, material, dummyList);
                }

                return result;
            });

            try {
                const calculate = new Function('objectMap', `return ${formula}`);
                item.Length = calculate(objectMap);
            } catch (e) {
                console.error(`Error evaluating formula for item: ${item.Title} ${item.Description} ${item.Material}`, e);
                item.Length = null; // or handle the error as needed
            }
        }
    });

    return objectMap;
};



const calculateQuantity = (objectMap, inputDimensions, outputDimensions, dummyList) => {
    const { ilength, iwidth, iheight, ift3 } = inputDimensions;
    const { olength, owidth, oheight, oft3 } = outputDimensions;

    return objectMap.map(item => {
        if (typeof item.Quantity === 'string') {
            let formula = item.Quantity;

            // Replace variables in formula with actual values
            formula = formula
                .replace(/ilength/g, ilength)
                .replace(/iwidth/g, iwidth)
                .replace(/iheight/g, iheight)
                .replace(/ift3/g, ift3)
                .replace(/olength/g, olength)
                .replace(/owidth/g, owidth)
                .replace(/oheight/g, oheight)
                .replace(/oft3/g, oft3);

            // Evaluate dynamic findItemsInMaterialList calls within the formula
            formula = formula.replace(/findItemsInMaterialList\(([^)]+)\)/g, (_, args) => {
                // Split and trim the args considering commas within the material string
                const parsedArgs = args.match(/'([^']+)'|"([^"]+)"|([^,]+)/g).map(arg => arg.trim().replace(/^['"]|['"]$/g, ''));

                let part = parsedArgs[0];
                let title = parsedArgs[1];
                let description, material;

                // Check if description contains commas
                if (parsedArgs.length >= 5 && parsedArgs[2].includes('Cleat')) {
                    description = parsedArgs.slice(2, 4).join(', ').trim();
                    material = parsedArgs.slice(4, 6).join(', ').trim();
                } else {
                    description = parsedArgs[2];
                    material = parsedArgs.slice(3, 5).join(', ').trim();
                }

                let result = findItemsInMaterialList(part, title, description, material, objectMap);

                if (!result && dummyList) {
                    result = findItemsInMaterialListOfList(part, title, description, material, dummyList);
                }

                return result;
            });

            try {
                // Use Function constructor to create a function with objectMap in its scope
                const calculate = new Function('objectMap', `return ${formula}`);
                item.Quantity = calculate(objectMap);
            } catch (e) {
                console.error(`Error evaluating formula for Quantity of item: ${item.Title} ${item.Description} ${item.Material}`, e);
                item.Quantity = null; // or handle the error as needed
            }
        }

        return item;
    });
};


function isInt(value) {
    // Check if the value is a number and it is an integer
    return typeof value === 'number' && Number.isInteger(value);
};




function processComponents(componentsMap, inputDimensions) {
    const results = [];
    let listAfterCalculating = [];
    let dummyList = [];
    let outputDimensions;

    Object.entries(componentsMap).forEach(([component, isActive]) => {
        const componentObjectMap = componentDataMap[component];
        if (!componentObjectMap) {
            console.error(`No data found for component: ${component}`);
            return;
        }

        const componentObject = getObjectByKey(component, componentObjectMap);
        const basicObject = { componentObject, materials };
        const objectMap = getBasicStructuredList(basicObject);

        // Calculate outputDimensions only if empty
        if (!outputDimensions) {
            const { olength, owidth, oheight } = getOLWHfromData(
                inputDimensions.ilength,
                inputDimensions.iwidth,
                inputDimensions.iheight,
                objectMap
            );
            const oft3 = calculateFt3(olength, owidth, oheight);
            outputDimensions = { olength, owidth, oheight, oft3 };
        }

        // Process calculations only if outputDimensions is available
        if (outputDimensions) {
            listAfterCalculating = calculateWidth(objectMap, inputDimensions, outputDimensions, dummyList);
            listAfterCalculating = calculateLength(listAfterCalculating, inputDimensions, outputDimensions, dummyList);
            listAfterCalculating = calculateQuantity(listAfterCalculating, inputDimensions, outputDimensions, dummyList);
            listAfterCalculating = calculateQtyUomList(listAfterCalculating, inputDimensions, outputDimensions, dummyList);
            listAfterCalculating = calculateCost(listAfterCalculating, inputDimensions, outputDimensions, dummyList);

            const materialCost = calculateMaterialCost(listAfterCalculating);
            dummyList.push(listAfterCalculating);
            results.push({ component, materialCost });
        }
    });

    //console.log(dummyList, 'List After Calculating');
    return results;
}


const componentDataMap = {
    crate,
    floater,
    barrier,
    blocking,
};

function calculateEstimatedMaterialCost(materialCosts, componentsMap) {
    const finalCost = materialCosts.reduce((total, item) => {
        if (componentsMap[item.component]) {
            return total + item.materialCost;
        }
        return total;
    }, 0);

    return finalCost;
};

function calculateFinalEstimatedLabourAndMaterialCost(estimatedMaterialCost, complexityMap, calculationType) {
    let finalCost = 0;

    if (calculationType === 'Old') {
        return 0;
    } else {     
        //console.log(estimatedMaterialCost, 'Estimated Material Cost');
        //console.log(complexityMap, 'Complexity Map');
        //console.log(calculationType, 'Calculation Type');   
        let complexityLevel = '';

        // Determine the highest complexity level
        if (complexityMap.complex) {
            complexityLevel = 'Complex';
        } else if (complexityMap.medium) {
            complexityLevel = 'Medium';
        } else if (complexityMap.simple) {
            complexityLevel = 'Simple';
        }

        //console.log(complexityLevel, 'Complexity Level');
        // Calculate costs based on the highest complexity level found
        switch (complexityLevel) {
            case 'Simple':
                finalCost = {
                    materialCost: estimatedMaterialCost,
                    labourCost: parseFloat((estimatedMaterialCost * 0.75))
                };
                break;
            case 'Medium':
                finalCost = {
                    materialCost: estimatedMaterialCost,
                    labourCost: parseFloat(estimatedMaterialCost)
                };
                break;
            case 'Complex':
                const materialCostComplex = parseFloat((estimatedMaterialCost * 1.20));
                finalCost = {
                    materialCost: materialCostComplex,
                    labourCost: parseFloat((materialCostComplex * 1.20))
                };
                break;
            default:
                finalCost = {
                    materialCost: 0,
                    labourCost: 0
                };
        }

        //console.log('Final Cost : ',finalCost);
    }

    return finalCost;
};

function calculateFinalCost(finalEstimatedLabourCost){
    let finalCost = 0;
        finalCost = finalEstimatedLabourCost.materialCost + finalEstimatedLabourCost.labourCost;
    return finalCost;
};

function calculateFinalSellPrice(finalCost, margin){
    let sellPrice = 0;
        sellPrice = parseFloat((finalCost / (1 - margin)).toFixed(2));
    return sellPrice;
}