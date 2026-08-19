"""
Shark/Ninja robot vacuum bridge — subprocess helper called from homeAutomationService.mjs.

Commands:
  discover --username EMAIL --password PASS [--europe]
  action   --username EMAIL --password PASS --serial DSN --action start|stop|dock|pause|status [--power eco|normal|max] [--europe]

Output: JSON on stdout, error text on stderr with non-zero exit code.
"""
import argparse
import asyncio
import json
import sys

from sharkiq import get_ayla_api, OperatingModes, PowerModes, Properties


ACTIONS = ('start', 'stop', 'dock', 'pause', 'status', 'explore')

POWER_MAP = {
    'eco': PowerModes.ECO,
    'normal': PowerModes.NORMAL,
    'max': PowerModes.MAX,
}


def vacuum_payload(v):
    """Serialise a SharkIqVacuum into a plain dict."""
    try:
        op_mode = v.get_property_value(Properties.OPERATING_MODE)
        op_name = OperatingModes(op_mode).name.lower() if op_mode is not None else 'unknown'
    except Exception:
        op_name = 'unknown'
        op_mode = None
    try:
        charge = v.get_property_value(Properties.BATTERY_CAPACITY)
    except Exception:
        charge = None
    try:
        error_code = v.get_property_value(Properties.ERROR_CODE)
    except Exception:
        error_code = None
    try:
        fw = v.get_property_value(Properties.ROBOT_FIRMWARE_VERSION)
    except Exception:
        fw = None
    return {
        'serial': v.serial_number,
        'name': v.name,
        'model': v.oem_model_number,
        'operatingMode': op_name,
        'operatingModeValue': op_mode,
        'batteryPercent': charge,
        'errorCode': error_code,
        'firmware': fw,
        'running': op_name in ('start', 'explore', 'mop', 'vaccum_and_mop'),
    }


async def _discover(username, password, europe):
    api = get_ayla_api(username, password, europe=europe)
    await api.async_sign_in()
    try:
        devices = await api.async_get_devices(update=True)
        return [vacuum_payload(v) for v in devices]
    finally:
        if api.websession and not api.websession.closed:
            await api.websession.close()


async def _action(username, password, serial, action, power, europe):
    api = get_ayla_api(username, password, europe=europe)
    await api.async_sign_in()
    try:
        devices = await api.async_get_devices(update=False)
        vacuum = next((v for v in devices if v.serial_number == serial), None)
        if vacuum is None:
            raise ValueError(f'Device with serial {serial!r} not found on account')
        await vacuum.async_update()

        if action == 'start':
            await vacuum.async_set_operating_mode(OperatingModes.START)
            if power:
                await vacuum.async_set_property_value(Properties.POWER_MODE, POWER_MAP[power])
        elif action == 'stop':
            await vacuum.async_set_operating_mode(OperatingModes.STOP)
        elif action == 'pause':
            await vacuum.async_set_operating_mode(OperatingModes.PAUSE)
        elif action == 'dock':
            await vacuum.async_set_operating_mode(OperatingModes.RETURN)
        elif action == 'explore':
            await vacuum.async_set_operating_mode(OperatingModes.EXPLORE)
        elif action != 'status':
            raise ValueError(f'Unknown action: {action!r}')

        await vacuum.async_update()
        return vacuum_payload(vacuum)
    finally:
        if api.websession and not api.websession.closed:
            await api.websession.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--europe', action='store_true', default=False)
    sub = parser.add_subparsers(dest='command', required=True)

    disc = sub.add_parser('discover')
    disc.add_argument('--username', required=True)
    disc.add_argument('--password', required=True)

    act = sub.add_parser('action')
    act.add_argument('--username', required=True)
    act.add_argument('--password', required=True)
    act.add_argument('--serial', required=True)
    act.add_argument('--action', choices=ACTIONS, required=True)
    act.add_argument('--power', choices=list(POWER_MAP), default=None)

    args = parser.parse_args()

    try:
        if args.command == 'discover':
            result = asyncio.run(_discover(args.username, args.password, args.europe))
        else:
            result = asyncio.run(_action(
                args.username, args.password, args.serial,
                args.action, args.power, args.europe,
            ))
        print(json.dumps(result, separators=(',', ':'), default=str))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
