var app = function () {
    'use strict';

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

    function data(name, resource, parm_id, parm_value, type) {
        this._name = name;
        this._resource = resource;
        this._url = '/' + resource;
        this._parm_id = parm_id;
        this._parm_value = parm_value;
        this._type = type;

        this._data = [];
        this._element = undefined;
        this._error_text = '';

        this._linked_filters = [];

        this._onupdate = [];

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
            return function (success_callback) {
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
                            request_success(scope, data, success_callback)
                        }
                    })(scope),
                    error: (function (scope) {
                        return function (xhr, status, errordata) {
                            request_error(xhr, status, error, scope)
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

        //this.update();
    }

    function data_view() {
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
                $('<div/>', { text: 'Gear: ' + item.gear_id }).appendTo(pdiv);
                $('<div/>', { text: 'Displacement: ' + item.displacement }).appendTo(pdiv);
                $('<div/>', { text: 'Chasis: ' + item.chasis }).appendTo(pdiv);
                let fuel = fuels.find(x => x.fuel === item.fuel) || { name: '' }
                $('<div/>', { text: 'Fuel: ' + fuel.name }).appendTo(pdiv);
                let price = item.price || 0;
                let fprice = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);
                $('<div/>', { text: 'Price: ' + fprice }).appendTo(pdiv);
                $('<div/>', { text: 'Count: ' + item.count }).appendTo(pdiv);
            });
        }
    }

    const view = new data_view();
    const storage = {};

    storage.config = { url: 'https://config-api.winner.ua/api', key: 'B84279CE-DFEE-4351-B446-870C9A1CA905' };

    var defers = [];

    storage.filters = {};
    storage.filters.brands = new data('Бренд', 'brands', 'brand_id', 'brand');
    storage.filters.brands._element = view.create_select_element(storage.filters.brands._resource);
    storage.filters.brands.add_onupdate(view.element_select_update)
    defers.push(storage.filters.brands.update());

    storage.filters.models = new data('Модель', 'models', 'model', 'model');
    storage.filters.models._element = view.create_select_element(storage.filters.models._resource);
    storage.filters.models.add_onupdate(view.element_select_update)
    defers.push(storage.filters.models.update());

    storage.filters.fuel = new data('Тип палива', 'fuel', 'fuel', 'name');
    storage.filters.fuel._element = view.create_select_element(storage.filters.fuel._resource);
    storage.filters.fuel.add_onupdate(view.element_select_update)
    defers.push(storage.filters.fuel.update());

    storage.filters.gears_types = new data('Коробка передач', 'gears_types', 'gear_type_id', 'gear_type');
    storage.filters.gears_types._element = view.create_select_element(storage.filters.gears_types._resource);
    storage.filters.gears_types.add_onupdate(view.element_select_update)
    defers.push(storage.filters.gears_types.update());

    storage.filters.chasis = new data('Тип кузова', 'chasis', 'chasis', 'chasis');
    storage.filters.chasis._element = view.create_select_element(storage.filters.chasis._resource);
    storage.filters.chasis.add_onupdate(view.element_select_update)
    defers.push(storage.filters.chasis.update());

    $.each(storage.filters, function (index, value) {
        $('#filter').append(value._element);
        let filter_element = value._element.find('select');
        filter_element.chosen({ width: '98%', placeholder_text_multiple: value._name }).trigger("chosen:updated");
    });

    storage.filters.models.add_linked_filter(storage.filters.brands);

    const fuels = [];
    const brands = [];
    const gears_types = [];

    $.when(
        ...defers
    ).done(function () {

        fuels.push(...storage.filters.fuel._data);
        brands.push(...storage.filters.brands._data);
        gears_types.push(...storage.filters.gears_types._data);

        storage.vehicles_group = new data('Авто', 'vehicles_group', 'id', 'model');
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