'use strict';

var app = function () {
    function event(sender) {
        this._sender = sender;
        this._listeners = [];
    }

    event.prototype = {
        attach: function (listener) {
            this._listeners.push(listener);
        },
        notify: function (args) {
            var index;

            for (index = 0; index < this._listeners.length; index += 1) {
                this._listeners[index](this._sender, args);
            }
        }
    };

    String.prototype.formatUnicorn = String.prototype.formatUnicorn ||
        function () {
            "use strict";
            var str = this.toString();
            if (arguments.length) {
                var t = typeof arguments[0];
                var key;
                var args = ("string" === t || "number" === t) ?
                    Array.prototype.slice.call(arguments)
                    : arguments[0];

                for (key in args) {
                    str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
                }
            }

            return str;
        };

    function vehicles_model(name, resource, parm_id, parm_value) {
        this._name = name;
        this._resource = resource;
        this._url = '/' + resource;
        this._parm_id = parm_id;
        this._parm_value = parm_value;

        this._data = [];
        this._element = undefined;
        this._error_text = '';

        this._linked_filters = [];

        this._onupdate = [];

        this._parm_group_id = "";
        this._parm_group_value = "";
        this._group_data = [];

        var request_error = function (xhr, status, error, scope) {
            scope._error_text = status;
        }

        var request_success = function (scope, data) {
            scope._data = data;

            for (let index = 0; index < scope._onupdate.length; index += 1) {
                scope._onupdate[index](scope, data);
            }
        }

        var options = function (scope) {
            let opts = {};
            scope._linked_filters.forEach(function (linked_filter) {
                let element = linked_filter._element.find('select');
                let values = element.chosen().val();
                if (values.length > 0)
                    opts[linked_filter._parm_id] = values.join();
            }, this);
            return opts;
        }

        this.add_linked_filter = function (filter) {
            this._linked_filters.push(filter);
            let filter_element = filter._element.find('select');
            filter_element.chosen().change(this.update);
        }

        this.update = (function (scope) {
            return function () {
                let full_url = storage.config.url + scope._url;

                function set_headers(xhr) {
                    xhr.setRequestHeader('apikey', storage.config.key);
                }

                var defer = $.ajax({
                    url: full_url,
                    type: 'GET',
                    data: options(scope),
                    dataType: 'json',
                    success: (function (scope) {
                        return function (data) {
                            request_success(scope, data)
                        }
                    })(scope),
                    error: (function (scope) {
                        return function (xhr, status, errordata) {
                            request_error(xhr, status, errordata, scope)
                        }
                    })(scope),
                    beforeSend: set_headers
                });

                return defer;
            }
        })(this);

        this.add_onupdate = function (onupdate_callback) {
            this._onupdate.push(onupdate_callback);
        }
    }

    function vehicles_view() {
        this.create_select_element = function (resource) {
            let element_div = $('<div/>');
            element_div.attr('id', resource + '_filter');
            element_div.addClass('filter-' + resource);
            element_div.addClass('filter-element');
            let element = $('<select/>');
            element.addClass('chosen-select');
            element.attr('multiple', true);
            element.appendTo(element_div);

            return element_div;
        }

        this.element_select_update = function (scope, data) {
            let element = scope._element.find('select');

            $.each(element.children(), function (index, value) {
                let opt = data.find(x => x[scope._parm_id] === value.value);
                if (typeof (opt) === "undefined") {
                    value.remove();
                } else {
                    let idx = data.indexOf(opt);
                    data.splice(idx, 1);
                }
            });

            $.each(data, function (index, value) {
                element.append(new Option(value[scope._parm_value], value[scope._parm_id]));
            });

            element.chosen().trigger("chosen:updated");
        }

        this.element_select_optgroup_update = function (scope, data) {
            let element = scope._element.find('select');

            $.each(element.find('option'), function (index, value) {
                let opt = data.find(x => x[scope._parm_id] === value.value);
                if (typeof (opt) === "undefined") {
                    value.remove();
                } else {
                    let idx = data.indexOf(opt);
                    data.splice(idx, 1);
                }
            });

            $.each(data, function (index, value) {
                let elements_group = element.find('optgroup[id="' + value[scope._parm_group_id] + '"]');
                let element_group;
                if (elements_group.length === 0) {
                    element_group = $('<optgroup/>');
                    element_group.attr('id', value[scope._parm_group_id]);

                    let label_obj = scope._group_data.find(x => x[scope._parm_group_id] === value[scope._parm_group_id])
                    let label = value[scope._parm_group_id];
                    if (typeof (label_obj) !== "undefined") {
                        label = label_obj[scope._parm_group_value];
                    }
                    element_group.attr('label', label);
                    element_group.appendTo(element);
                } else {
                    element_group = elements_group[0];
                }
                element_group.append(new Option(value[scope._parm_value], value[scope._parm_id]));
            });

            $.each(element.find('optgroup'), function (index, value) {
                if ($(value).children().length === 0)
                    value.remove();
            });
            
            let group_data_idx =  scope._group_data.map(function (x) { return x[scope._parm_group_id] });
            element.find('optgroup').sort(function (a, b) {
                let idx_a = group_data_idx.indexOf(a.id);
                let idx_b = group_data_idx.indexOf(b.id);
                if (idx_a > idx_b) {
                    b.parentNode.insertBefore(b, a);
                    return 1;
                }
                else if (idx_a < idx_b) {
                    a.parentNode.insertBefore(a, b);
                    return -1;
                }
                else return 0
            });

            element.chosen().trigger("chosen:updated");
        }

        this.put_to_page = function (err, data) {
            let car_data_element = $('#car_data');

            car_data_element.empty();

            $.each(data, (i, item) => {

                let udiv = $('<div/>', { class: 'car_box' });
                udiv.appendTo(car_data_element);
                let pdiv = $('<div/>', { id: 'car_' + i, class: 'car_card' });
                pdiv.appendTo(udiv);

                $('<div/>', { text: 'Brand: ' + item.brand }).appendTo(pdiv);
                $('<div/>', { text: 'Model: ' + item.model }).appendTo(pdiv);
                $('<div/>', { text: 'Year: ' + item.year }).appendTo(pdiv);
                let gear = gears.find(x => x.gear_id === item.gear_id) || { gear_name: '' }
                $('<div/>', { text: 'Gear: ' + gear.gear_name }).appendTo(pdiv);
                let engine_vol = parseFloat(Math.round(item.displacement * 100) / 100).toFixed(1);
                let engine_power = parseInt(item.power);
                let engine = '{0} л. ({1} к.с.)'.formatUnicorn(engine_vol, engine_power);
                $('<div/>', { text: 'Displacement: ' + engine }).appendTo(pdiv);
                $('<div/>', { text: 'Chasis: ' + item.chasis }).appendTo(pdiv);
                $('<div/>', { text: 'Version: ' + item.version }).appendTo(pdiv);
                let fuel = fuels.find(x => x.fuel === item.fuel) || { name: '' }
                $('<div/>', { text: 'Fuel: ' + fuel.name }).appendTo(pdiv);
                let price = item.price || 0;
                let fprice = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);
                $('<div/>', { text: 'Price: ' + fprice }).appendTo(pdiv);
                $('<div/>', { text: 'Count: ' + item.count }).appendTo(pdiv);
            });
        }
    }

    const view = new vehicles_view();
    const storage = {};

    storage.config = { url: 'https://morning-lake.gear.host/api', key: '886C688C-7DB2-4A3C-97A9-5EE6F062DF8D' };

    var defers = [];

    storage.filters = {};

    storage.filters.brands = new vehicles_model('Бренд', 'brands', 'brand_id', 'brand');
    storage.filters.brands._element = view.create_select_element(storage.filters.brands._resource);
    storage.filters.brands.add_onupdate(view.element_select_update)
    defers.push(storage.filters.brands.update());

    storage.filters.models = new vehicles_model('Модель', 'models', 'model', 'model');
    storage.filters.models._element = view.create_select_element(storage.filters.models._resource);

    storage.filters.fuel = new vehicles_model('Тип палива', 'fuel', 'fuel', 'name');
    storage.filters.fuel._element = view.create_select_element(storage.filters.fuel._resource);
    storage.filters.fuel.add_onupdate(view.element_select_update)
    defers.push(storage.filters.fuel.update());

    storage.filters.gears_types = new vehicles_model('Коробка передач', 'gears_types', 'gear_type_id', 'gear_type');
    storage.filters.gears_types._element = view.create_select_element(storage.filters.gears_types._resource);
    storage.filters.gears_types.add_onupdate(view.element_select_update)
    defers.push(storage.filters.gears_types.update());

    storage.filters.chasis = new vehicles_model('Тип кузова', 'chasis', 'chasis', 'chasis');
    storage.filters.chasis._element = view.create_select_element(storage.filters.chasis._resource);
    storage.filters.chasis.add_onupdate(view.element_select_update)
    defers.push(storage.filters.chasis.update());

    storage.filters.gears = new vehicles_model('Коробка передач', 'gears', 'gear_id', 'gear_name');
    defers.push(storage.filters.gears.update());

    $.each(storage.filters, function (index, value) {
        if (typeof (value._element) === "undefined")
            return true;
        $('#filter').append(value._element);
        let filter_element = value._element.find('select');
        filter_element.chosen({ width: '98%', placeholder_text_multiple: value._name }).trigger("chosen:updated");
    });

    const fuels = [];
    const brands = [];
    const gears_types = [];
    const gears = [];

    $.when(
        ...defers
    ).done(function () {

        fuels.push(...storage.filters.fuel._data);
        brands.push(...storage.filters.brands._data);
        gears_types.push(...storage.filters.gears_types._data);
        gears.push(...storage.filters.gears._data);

        storage.filters.models._parm_group_id = 'brand_id';
        storage.filters.models._parm_group_value = 'brand';
        storage.filters.models._group_data.push(...brands);
        storage.filters.models.add_onupdate(view.element_select_optgroup_update)
        storage.filters.models.update();

        storage.filters.models.add_linked_filter(storage.filters.brands);

        storage.vehicles_group = new vehicles_model('Авто', 'vehicles_group', 'id', 'model');
        storage.vehicles_group.add_onupdate(view.put_to_page)
        storage.vehicles_group.add_linked_filter(storage.filters.brands);
        storage.vehicles_group.add_linked_filter(storage.filters.models);
        storage.vehicles_group.add_linked_filter(storage.filters.fuel);
        storage.vehicles_group.add_linked_filter(storage.filters.gears_types);
        storage.vehicles_group.add_linked_filter(storage.filters.chasis);

        storage.vehicles_group.update();
    });
}

window.onload = app;