exports = async function(changeEvent) {
  /*
    A Database Trigger will always call a function with a changeEvent.
    Documentation on ChangeEvents: https://docs.mongodb.com/manual/reference/change-events/

    Access the _id of the changed document:
    const docId = changeEvent.documentKey._id;

    Access the latest version of the changed document
    (with Full Document enabled for Insert, Update, and Replace operations):
    const fullDocument = changeEvent.fullDocument;

    const updateDescription = changeEvent.updateDescription;

    See which fields were changed (if any):
    if (updateDescription) {
      const updatedFields = updateDescription.updatedFields; // A document containing updated fields
    }

    See which fields were removed (if any):
    if (updateDescription) {
      const removedFields = updateDescription.removedFields; // An array of removed fields
    }

    Functions run by Triggers are run as System users and have full access to Services, Functions, and MongoDB Data.

    Access a mongodb service:
    const collection = context.services.get(<SERVICE_NAME>).db("db_name").collection("coll_name");
    const doc = collection.findOne({ name: "mongodb" });

    Note: In Atlas Triggers, the service name is defaulted to the cluster name.

    Call other named functions if they are defined in your application:
    const result = context.functions.execute("function_name", arg1, arg2);

    Access the default http client and execute a GET request:
    const response = context.http.get({ url: <URL> })

    Learn more about http client here: https://docs.mongodb.com/realm/functions/context/#context-http
  */
  /*===============================================================
  - Date:       Author:           Version:        Notes:
  -----------------------------------------------------------------
  - 2020-06-24  Britton LaRoche   1.0            Initial Release
  -
  ===============================================================*/
  const fullDocument = changeEvent.fullDocument;
  const sales = context.services.get("mongodb-atlas").db("InventoryDemo").collection("sales");
  const inventoryHist = context.services.get("mongodb-atlas").db("InventoryDemo").collection("inventory_hist");
  const last = context.services.get("mongodb-atlas").db("InventoryDemo").collection("inventory_last");
  console.log("inside fnc_sales")
  
  //check to make sure we have a full document
  if (fullDocument){
    console.log("inside fnc_sales. fullDocument: " + JSON.stringify(fullDocument));
  } else {
    console.log("inside fnc_sales. fullDocument is missing");
    return;
  }
  
  //check to make sure we have a full document
  if (fullDocument._id){
    console.log("inside fnc_sales. fullDocument._id: " + fullDocument._id);
  } else {
    console.log("inside fnc_sales. fullDocument._id is missing");
    return;
  }
  
  var fullCopy = fullDocument;
  var vDate = new Date();
  
  fullCopy.Item_id = fullDocument._id;
  delete fullCopy._id;
  fullCopy.Date = vDate;
  
  //stuff it in the history
  console.log("inside fnc_sales. Inserting into inventory_hist");
  inventoryHist.insertOne(fullCopy);
  
  //get the last document for this Item_id
  //determine the differnce in inventory quantity from the curent document.
  //If the last is greater than current its a sale
  //If the last is less than current its a restock
  var lastUpdate = await last.find({"Item_id": fullCopy.Item_id}).toArray()
    .then(docs => {
      var lastQuantity = 0;
      docs.map(c => {
        if (c) {
              lastQuantity =  c.quantity;
        }
      });
      if (lastQuantity > fullCopy.quantity) {
        //we have gone down in inventory insert into sales collection
        var vSoldQuantity = lastQuantity - fullCopy.quantity;
        var vPrice = fullCopy.price;
        var vSoldPrice = vSoldQuantity * vPrice;
        fullCopy.sold_quantity =  vSoldQuantity;
        fullCopy.sold_price =  vSoldPrice;
        sales.insertOne(fullCopy);
      }
    });
  //update the last document
    last.updateOne(
      { "Item_id": fullCopy.Item_id},
      {$set: 
        { "_partition": fullCopy._partition,
          "name": fullCopy.name,
          "price": fullCopy.price,
          "quantity": fullCopy.quantity,
          "min_quantity": fullCopy.min_quantity,
          "supplier": fullCopy.supplier,
          "date": fullCopy.date
      }},
      {upsert: true}
    );
  
  //Lets calculate the number sold based on the last inventory amount. 
  
};
