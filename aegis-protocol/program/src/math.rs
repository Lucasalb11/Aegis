use crate::errors::ErrorCode;

pub fn add_u64(a: u64, b: u64) -> Result<u64, ErrorCode> {
    a.checked_add(b).ok_or(ErrorCode::ArithmeticOverflow)
}

pub fn sub_u64(a: u64, b: u64) -> Result<u64, ErrorCode> {
    a.checked_sub(b).ok_or(ErrorCode::ArithmeticOverflow)
}

pub fn add_i64(a: i64, b: i64) -> Result<i64, ErrorCode> {
    a.checked_add(b).ok_or(ErrorCode::ArithmeticOverflow)
}

pub fn sub_i64(a: i64, b: i64) -> Result<i64, ErrorCode> {
    a.checked_sub(b).ok_or(ErrorCode::ArithmeticOverflow)
}

#[inline]
pub fn integer_sqrt(value: u128) -> u128 {
    if value == 0 {
        return 0;
    }
    let mut x0 = value;
    let mut x1 = (value >> 1) + 1;
    while x1 < x0 {
        x0 = x1;
        x1 = (x1 + value / x1) >> 1;
    }
    x0
}

pub fn pow10(exponent: u32) -> Result<u64, ErrorCode> {
    match exponent {
        0 => Ok(1),
        1 => Ok(10),
        2 => Ok(100),
        3 => Ok(1000),
        4 => Ok(10000),
        5 => Ok(100000),
        6 => Ok(1000000),
        7 => Ok(10000000),
        8 => Ok(100000000),
        9 => Ok(1000000000),
        _ => Err(ErrorCode::ArithmeticOverflow),
    }
}