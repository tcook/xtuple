/*jshint bitwise:true, indent:2, curly:true, eqeqeq:true, immed:true,
latedef:true, newcap:true, noarg:true, regexp:true, undef:true,
trailing:true, white:true, strict: false*/
/*global XT:true, XM:true, XV:true, enyo:true, Globalize: true*/

(function () {

  XT.extensions.manufacturing.initWorkspaces = function () {

    // ..........................................................
    // CONFIGURE
    //

    enyo.kind({
      name: "XV.ManufacturingWorkspace",
      kind: "XV.Workspace",
      title: "_configure".loc() + " " + "_manufacturing".loc(),
      model: "XM.Manufacturing",
      components: [
        {kind: "Panels", arrangerKind: "CarouselArranger",
          fit: true, components: [
          {kind: "XV.Groupbox", name: "mainPanel", components: [
            {kind: "XV.ScrollableGroupbox", name: "mainGroup", fit: true,
              classes: "in-panel", components: [
              {kind: "onyx.GroupboxHeader", content: "_reporting".loc()}
            ]}
          ]}
        ]}
      ]
    });

    // ..........................................................
    // ISSUE MATERIAL
    //

    enyo.kind({
      name: "XV.IssueMaterialWorkspace",
      kind: "XV.Workspace",
      title: "_issueStock".loc(),
      model: "XM.IssueMaterial",
      backText: "_cancel".loc(),
      saveText: "_issue".loc(),
      hideApply: true,
      hideRefresh: true,
      dirtyWarn: false,
      events: {
        onPrevious: ""
      },
      handlers: {
        onDetailSelectionChanged: "toggleDetailSelection",
        onDistributedTapped: "distributedTapped"
      },
      components: [
        {kind: "Panels", arrangerKind: "CarouselArranger",
          fit: true, components: [
          {kind: "XV.Groupbox", name: "mainPanel", components: [
            {kind: "onyx.GroupboxHeader", content: "_order".loc()},
            {kind: "XV.ScrollableGroupbox", name: "mainGroup",
              classes: "in-panel", fit: true, components: [
              {kind: "XV.WorkOrderWidget", attr: "order"},
              {kind: "onyx.GroupboxHeader", content: "_item".loc()},
              {kind: "XV.ItemSiteWidget", attr:
                {item: "itemSite.item", site: "itemSite.site"}
              },
              {kind: "XV.QuantityWidget", attr: "qtyRequired"},
              {kind: "XV.QuantityWidget", attr: "qtyIssued"},
              //{kind: "XV.QuantityWidget", attr: "returned"},
              //{kind: "XV.QuantityWidget", attr: "balance"},
              {kind: "onyx.GroupboxHeader", content: "_issue".loc()},
              {kind: "XV.QuantityWidget", attr: "toIssue", name: "toIssue"},
            ]}
          ]},
          {kind: "XV.IssueMaterialDetailRelationsBox",
            attr: "itemSite.detail", name: "detail"}
        ]},
        {kind: "onyx.Popup", name: "distributePopup", centered: true,
          onHide: "popupHidden",
          modal: true, floating: true, components: [
          {content: "_quantity".loc()},
          {kind: "onyx.InputDecorator", components: [
            {kind: "onyx.Input", name: "quantityInput"}
          ]},
          {tag: "br"},
          {kind: "onyx.Button", content: "_ok".loc(), ontap: "distributeOk",
            classes: "onyx-blue xv-popup-button"},
          {kind: "onyx.Button", content: "_cancel".loc(), ontap: "distributeDone",
            classes: "xv-popup-button"},
        ]}
      ],
      /**
        Overload: Some special handling for start up.
        */
      attributesChanged: function () {
        this.inherited(arguments);
        var model = this.getValue();

        // Focus and select qty on start up.
        if (!this._started && model &&
          model.getStatus() === XM.Model.READY_DIRTY) {
          this.$.toIssue.focus();
          this.$.toIssue.$.input.selectContents();
          this._started = true;
        }

        // Hide detail if not applicable
        if (!model.requiresDetail()) {
          this.$.detail.hide();
          this.parent.parent.$.menu.refresh();
        }
      },
      /**
        Overload to handle callback chain.
      */
      destroy: function () {
        var model = this.getValue(),
          callback = this.getCallback();

        // If there's a callback then call it with false
        // to let it know to cancel process
        if (model.isDirty() && callback) {
          callback(false);
        }
        this.inherited(arguments);
      },
      distributeDone: function () {
        this._popupDone = true;
        delete this._distModel;
        this.$.distributePopup.hide();
      },
      distributeOk: function () {
        var qty = this.$.quantityInput.getValue(),
          dist = this._distModel;
        qty = Globalize.parseFloat(qty);
        dist.set("distributed", qty);
        if (dist._validate(dist.attributes, {})) {
          this.distributeDone();
          this.$.detail.$.list.refresh();
        }
      },
      distributedTapped: function (inSender, inEvent) {
        var input = this.$.quantityInput,
          qty = inEvent.model.get("distributed");
        this._popupDone = false;
        this._distModel = inEvent.model;
        this.$.distributePopup.show();
        qty = Globalize.format(qty, "n" + XT.QTY_SCALE);
        input.setValue(qty);
        input.focus();
        input.selectContents();
      },
      popupHidden: function (inSender, inEvent) {
        if (!this._popupDone) {
          inEvent.originator.show();
        }
      },
      /**
        Overload: This version of save looks for a callback. If it's
        there then the assumption is we're doing a series of issues
        so forward to the next one.
      */
      save: function () {
        var callback = this.getCallback();
        if (callback) {
          callback(this);
        } else {
          this.inherited(arguments);
        }
      },
      /**
        If detail has been selected or deselected, handle default distribution.
      */
      toggleDetailSelection: function (inSender, inEvent) {
        var detail = inEvent.model,
          isDistributed = detail.get("distributed") > 0,
          undistributed;
        if (!detail) { return; }
        if (isDistributed) {
          detail.clear();
        } else {
          undistributed = this.getValue().undistributed();
          detail.distribute(undistributed);
        }
      }
    });

    // ..........................................................
    // POST PRODUCTION
    //

    enyo.kind({
      name: "XV.PostProductionWorkspace",
      kind: "XV.Workspace",
      title: "_postProduction".loc(),
      model: "XM.PostProduction",
      reportModel: "XM.WorkOrder",
      saveText: "_post".loc(),
      allowNew: false,
      hideApply: true,
      dirtyWarn: false,
      events: {
        onPrint: ""
      },
      components: [
        {kind: "Panels", arrangerKind: "CarouselArranger",
          fit: true, components: [
          {kind: "XV.Groupbox", name: "mainPanel", components: [
            {kind: "onyx.GroupboxHeader", content: "_overview".loc()},
            {kind: "XV.ScrollableGroupbox", name: "mainGroup",
              classes: "in-panel", fit: true, components: [
              {kind: "XV.InputWidget", attr: "number"},
              {kind: "XV.DateWidget", attr: "dueDate"},
              {kind: "XV.ItemSiteWidget", attr:
                {item: "itemSite.item", site: "itemSite.site"}
              },
              {kind: "XV.InputWidget", attr: "status"},
              {kind: "XV.InputWidget", attr: "cosMethod"},
              {kind: "XV.QuantityWidget", attr: "qtyOrdered"},
              {kind: "XV.QuantityWidget", attr: "qtyRequired"},
              {kind: "XV.QuantityWidget", attr: "balance"},
              {kind: "XV.QuantityWidget", attr: "qtyToPost"},
              {kind: "onyx.GroupboxHeader", content: "_notes".loc()},
              {kind: "XV.TextArea", attr: "productionNotes", fit: true},
              {kind: "onyx.GroupboxHeader", content: "_options".loc()},
              {kind: "XV.StickyCheckboxWidget", label: "_backflushMaterials".loc(),
                name: "backflushMaterials"},
              {kind: "XV.StickyCheckboxWidget", label: "_closeWorkOrderAfterPosting".loc(),
                name: "closeWorkOrderAfterPosting"},
              {kind: "XV.StickyCheckboxWidget", label: "_scrapOnPost".loc(),
                name: "scrapOnPost"}
            ]}
          ]}
          //{kind: "XV.ShipmentLineRelationsBox", attr: "lineItems"}
        ]}
      ]/*,
      create: function (options) {
        this.inherited(arguments);
        if (!this.getBiAvailable()) {
          this.$.printPacklist.setChecked(false);
          this.$.printPacklist.setDisabled(true);
        }
      },
      save: function (options) {
        if (this.$.printPacklist.isChecked()) {
          this.doPrint();
        }
        this.inherited(arguments);
      }*/
    });

  };
}());
